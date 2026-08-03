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

type NotifType = 'photo_uploaded' | 'partner_uploaded' | 'vote_cast' | 'game_done'

type Body = {
  type: NotifType
  exclude_user_id?: string | null
  target_user_id?: string | null
  actor_name?: string | null
  liked?: boolean | null
}

Deno.serve(async (req) => {
  let body: Body = { type: 'photo_uploaded' }
  try { body = await req.json() } catch { /* pas de body */ }

  let title = ''
  let notifBody = ''
  let tag = 'photo-game'

  if (body.type === 'photo_uploaded') {
    title = '📸 Ton partenaire a uploadé !'
    notifBody = "C'est ton tour ! Upload ta photo pour ce thème."
    tag = 'photo-game-upload'

  } else if (body.type === 'partner_uploaded') {
    title = '📸 Ton partenaire a uploadé sa photo !'
    notifBody = 'Viens la découvrir et voter dans Photo Duel !'
    tag = 'photo-game-vote'

  } else if (body.type === 'vote_cast') {
    const verb = body.liked ? 'liké' : 'pas aimé'
    title = `${body.actor_name ?? 'Ton partenaire'} a ${verb} ta photo !`
    notifBody = "C'est à ton tour de voter sur la sienne."
    tag = 'photo-game-vote-cast'

  } else if (body.type === 'game_done') {
    title = '🎉 Photo Duel terminé !'
    notifBody = 'Découvrez les votes de votre partenaire.'
    tag = 'photo-game-done'

  } else {
    return new Response('Type inconnu', { status: 400 })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')

  let targets = subs ?? []
  if (body.target_user_id) {
    targets = targets.filter((s) => s.user_id === body.target_user_id)
  } else if (body.exclude_user_id) {
    targets = targets.filter((s) => s.user_id !== body.exclude_user_id)
  }

  if (!targets.length) return new Response('Aucun destinataire', { status: 200 })

  await Promise.allSettled(
    targets.map(({ subscription }) =>
      webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body: notifBody, tag }),
      ).catch(() => null)
    ),
  )

  return new Response(`"${body.type}" envoyé (${targets.length})`, { status: 200 })
})
