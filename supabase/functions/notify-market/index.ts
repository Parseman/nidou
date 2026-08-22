import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { sendPushToAll } from '../_shared/webpush.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createSupabaseAdmin()

type NotifType = 'item_purchased' | 'item_fulfilled'

type Body = {
  type: NotifType | ''
  exclude_user_id?: string | null
  actor_name?: string | null
  item_label?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: Body = { type: '' }
  try { body = await req.json() } catch { /* pas de body */ }

  let title = ''
  let notifBody = ''
  let tag = 'market'

  if (body.type === 'item_purchased') {
    title = '🛍️ Nouvelle demande !'
    notifBody = `${body.actor_name ?? 'Ton partenaire'} a acheté "${body.item_label ?? 'une demande'}" — à toi de la réaliser !`
    tag = 'market-purchase'

  } else if (body.type === 'item_fulfilled') {
    title = '✅ Demande réalisée !'
    notifBody = `${body.actor_name ?? 'Ton partenaire'} a réalisé "${body.item_label ?? 'ta demande'}" !`
    tag = 'market-fulfilled'

  } else {
    return new Response('Type inconnu', { status: 400, headers: corsHeaders })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')

  let targets = subs ?? []
  if (body.exclude_user_id) {
    targets = targets.filter((s) => s.user_id !== body.exclude_user_id)
  }

  if (!targets.length) return new Response('Aucun destinataire', { status: 200, headers: corsHeaders })

  await sendPushToAll(targets, { title, body: notifBody, tag })

  return new Response(`"${body.type}" envoyé (${targets.length})`, { status: 200, headers: corsHeaders })
})
