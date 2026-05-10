import webpush from 'npm:web-push@3'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

webpush.setVapidDetails(
  'mailto:contact@nidou.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const DECAY_PER_HOUR = { hunger: 3, hygiene: 2, happiness: 1.5 }
const COOLDOWN_H = 3

function calcStats(pet: Record<string, unknown>) {
  const hrs = (ts: string) => (Date.now() - new Date(ts).getTime()) / 3_600_000
  const hunger    = Math.max(0, Math.min(100, (pet.hunger    as number) - DECAY_PER_HOUR.hunger    * hrs(pet.last_fed_at   as string)))
  const hygiene   = Math.max(0, Math.min(100, (pet.hygiene   as number) - DECAY_PER_HOUR.hygiene   * hrs(pet.last_washed_at as string)))
  const happiness = Math.max(0, Math.min(100, (pet.happiness as number) - DECAY_PER_HOUR.happiness * hrs(pet.last_pet_at    as string)))
  return { hunger, hygiene, happiness, overall: (hunger + hygiene + happiness) / 3 }
}

Deno.serve(async () => {
  const { data: pet, error } = await supabase
    .from('pet')
    .select('hunger, hygiene, happiness, last_fed_at, last_washed_at, last_pet_at, last_happiness_push_at')
    .eq('id', 1)
    .single()

  if (error || !pet) return new Response('Pet introuvable', { status: 404 })

  const stats = calcStats(pet)

  if (stats.overall >= 50) {
    return new Response(`Bien-être ok (${Math.round(stats.overall)})`, { status: 200 })
  }

  // Anti-spam
  if (pet.last_happiness_push_at) {
    const hoursAgo = (Date.now() - new Date(pet.last_happiness_push_at).getTime()) / 3_600_000
    if (hoursAgo < COOLDOWN_H) {
      return new Response(`Cooldown actif (${hoursAgo.toFixed(1)}h)`, { status: 200 })
    }
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')

  if (!subs?.length) return new Response('Aucun abonné', { status: 200 })

  const payload = JSON.stringify({
    title: '😿 Nidou a besoin de vous !',
    body: `Son bien-être global est à ${Math.round(stats.overall)}/100. Venez en prendre soin !`,
    tag: 'pet-sad',
  })

  await Promise.allSettled(
    subs.map((row) => webpush.sendNotification(row.subscription, payload))
  )

  await supabase
    .from('pet')
    .update({ last_happiness_push_at: new Date().toISOString() })
    .eq('id', 1)

  return new Response(`Notif envoyée (bien-être : ${Math.round(stats.overall)})`, { status: 200 })
})
