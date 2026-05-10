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

const DECAY_PER_HOUR = { happiness: 1.5 }
const COOLDOWN_H = 3

function calcHappiness(happiness: number, lastPetAt: string): number {
  const hrs = (Date.now() - new Date(lastPetAt).getTime()) / 3_600_000
  return Math.max(0, Math.min(100, happiness - DECAY_PER_HOUR.happiness * hrs))
}

Deno.serve(async () => {
  const { data: pet, error } = await supabase
    .from('pet')
    .select('happiness, last_pet_at, last_happiness_push_at')
    .eq('id', 1)
    .single()

  if (error || !pet) return new Response('Pet introuvable', { status: 404 })

  const currentHappiness = calcHappiness(pet.happiness, pet.last_pet_at)

  if (currentHappiness >= 50) {
    return new Response(`Bonheur ok (${Math.round(currentHappiness)})`, { status: 200 })
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
    title: '😿 Nidou est triste',
    body: `Son bonheur est tombé à ${Math.round(currentHappiness)}/100. Venez lui faire un câlin !`,
    tag: 'pet-sad',
  })

  await Promise.allSettled(
    subs.map((row) => webpush.sendNotification(row.subscription, payload))
  )

  await supabase
    .from('pet')
    .update({ last_happiness_push_at: new Date().toISOString() })
    .eq('id', 1)

  return new Response(`Notif envoyée (bonheur : ${Math.round(currentHappiness)})`, { status: 200 })
})
