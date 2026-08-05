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

type Body = {
  days?: number | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Méthode non supportée', { status: 405, headers: corsHeaders })

  let body: Body = {}
  try { body = await req.json() } catch { /* pas de body */ }

  const title = 'Date mise à jour !'
  let notifBody = 'La date de vos prochaines retrouvailles a changé.'
  if (typeof body.days === 'number') {
    notifBody = body.days === 0
      ? "C'est aujourd'hui ! 🎉"
      : body.days < 0
      ? 'Vous vous êtes vus ! 🥰'
      : `Plus que ${body.days} jour${body.days > 1 ? 's' : ''} avant de se revoir...`
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')

  if (!subs?.length) return new Response('Aucun destinataire', { status: 200, headers: corsHeaders })

  await Promise.allSettled(
    subs.map(({ subscription }) =>
      webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body: notifBody, tag: 'meeting-date' }),
      ).catch(() => null)
    ),
  )

  return new Response(`"date_updated" envoyé (${subs.length})`, { status: 200, headers: corsHeaders })
})
