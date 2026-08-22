import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { sendPushToAll } from '../_shared/webpush.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createSupabaseAdmin()

type Body = {
  days?: number | null
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

  await sendPushToAll(subs, { title, body: notifBody, tag: 'meeting-date' })

  return new Response(`"date_updated" envoyé (${subs.length})`, { status: 200, headers: corsHeaders })
})
