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

type NotifType = 'item_purchased' | 'item_fulfilled'

type Body = {
  type: NotifType | ''
  exclude_user_id?: string | null
  actor_name?: string | null
  item_label?: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  await Promise.allSettled(
    targets.map(({ subscription }) =>
      webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body: notifBody, tag }),
      ).catch(() => null)
    ),
  )

  return new Response(`"${body.type}" envoyé (${targets.length})`, { status: 200, headers: corsHeaders })
})
