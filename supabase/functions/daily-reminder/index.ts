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

Deno.serve(async () => {
  const { data: challenges } = await supabase
    .from('challenges')
    .select('id, title')
    .in('status', ['pending', 'proof_submitted'])

  if (!challenges?.length) {
    return new Response('Aucun défi en cours', { status: 200 })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')

  if (!subs?.length) {
    return new Response('Aucun abonné', { status: 200 })
  }

  const body = challenges.map((c) => `• ${c.title}`).join('\n')
  const payload = JSON.stringify({
    title: `⏰ ${challenges.length} défi${challenges.length > 1 ? 's' : ''} en attente`,
    body,
    tag: 'reminder',
  })

  await Promise.allSettled(
    subs.map((row) => webpush.sendNotification(row.subscription, payload))
  )

  return new Response(`Rappel envoyé pour ${challenges.length} défi(s)`, { status: 200 })
})
