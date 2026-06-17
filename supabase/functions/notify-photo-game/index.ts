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

type NotifType = 'photo_uploaded' | 'voting_ready' | 'game_done'

const MESSAGES: Record<NotifType, { title: string; body: string; tag: string }> = {
  photo_uploaded: {
    title: '📸 Ton partenaire a uploadé !',
    body: "C'est ton tour ! Upload ta photo pour ce thème.",
    tag: 'photo-game-upload',
  },
  voting_ready: {
    title: '🗳️ Les 2 photos sont là !',
    body: 'Votez maintenant pour le Photo Duel !',
    tag: 'photo-game-vote',
  },
  game_done: {
    title: '🎉 Photo Duel terminé !',
    body: 'Découvrez les votes de votre partenaire.',
    tag: 'photo-game-done',
  },
}

Deno.serve(async (req) => {
  let body: { type: NotifType; exclude_user_id?: string | null } = { type: 'photo_uploaded' }
  try { body = await req.json() } catch { /* pas de body */ }

  const msg = MESSAGES[body.type]
  if (!msg) return new Response('Type inconnu', { status: 400 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')

  const targets = body.exclude_user_id
    ? (subs ?? []).filter((s) => s.user_id !== body.exclude_user_id)
    : subs ?? []

  if (!targets.length) return new Response('Aucun destinataire', { status: 200 })

  await Promise.allSettled(
    targets.map(({ subscription }) =>
      webpush.sendNotification(
        subscription,
        JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag }),
      ).catch(() => null)
    ),
  )

  return new Response(`"${body.type}" envoyé (${targets.length})`, { status: 200 })
})
