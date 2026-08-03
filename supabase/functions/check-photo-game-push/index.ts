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

const DAY_MS = 24 * 60 * 60 * 1000

Deno.serve(async () => {
  const { data: game } = await supabase.from('photo_game').select('*').eq('id', 1).single()
  if (!game) return new Response('Pas de partie', { status: 200 })

  let title = ''
  let notifBody = ''
  let tag = ''
  let missingUserIds: string[] = []

  if (game.status === 'active') {
    const elapsedDays = (Date.now() - new Date(game.started_at).getTime()) / DAY_MS
    if (elapsedDays >= 2) {
      title = "VITE, plus qu'un jour !!"
      notifBody = "Il ne reste qu'un jour pour uploader ta photo du thème !"
      tag = 'photo-game-reminder-upload'
    } else if (elapsedDays >= 1) {
      title = 'Plus que 2 jours pour upload...'
      notifBody = 'Il te reste 2 jours pour uploader ta photo du thème.'
      tag = 'photo-game-reminder-upload'
    } else {
      return new Response('Trop tôt pour un rappel', { status: 200 })
    }

    const { data: users } = await supabase.auth.admin.listUsers()
    const uploaded = new Set([game.photo_1_user_id, game.photo_2_user_id].filter(Boolean))
    missingUserIds = (users?.users ?? []).map((u) => u.id).filter((id) => !uploaded.has(id))

  } else if (game.status === 'voting') {
    const elapsedDays = (Date.now() - new Date(game.updated_at).getTime()) / DAY_MS
    if (elapsedDays >= 2) {
      title = 'VITE, viens voter !!'
      notifBody = 'Ton partenaire attend ton vote sur Photo Duel !'
      tag = 'photo-game-reminder-vote'
    } else if (elapsedDays >= 1) {
      title = 'Plus que 2 jours pour voter...'
      notifBody = 'Il te reste 2 jours pour voter sur Photo Duel.'
      tag = 'photo-game-reminder-vote'
    } else {
      return new Response('Trop tôt pour un rappel', { status: 200 })
    }

    if (game.vote_1 === null && game.photo_2_user_id) missingUserIds.push(game.photo_2_user_id)
    if (game.vote_2 === null && game.photo_1_user_id) missingUserIds.push(game.photo_1_user_id)

  } else {
    return new Response('Rien à rappeler', { status: 200 })
  }

  if (!missingUserIds.length) return new Response('Personne à relancer', { status: 200 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')

  const targets = (subs ?? []).filter((s) => missingUserIds.includes(s.user_id))
  if (!targets.length) return new Response('Aucun destinataire', { status: 200 })

  await Promise.allSettled(
    targets.map(({ subscription }) =>
      webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body: notifBody, tag }),
      ).catch(() => null)
    ),
  )

  return new Response(`Rappel envoyé (${targets.length})`, { status: 200 })
})
