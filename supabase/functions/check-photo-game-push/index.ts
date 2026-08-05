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

// Calendrier fixe : le tour démarre jeudi 00h00 Paris et se termine (deadline
// upload/vote) mardi 23h59 Paris. Le mercredi est un jour mort (verrouillé,
// en attente du reset jeudi) : pas de rappel ce jour-là.
function daysUntilDeadline(): number | null {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(new Date())
  const dow: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const isoDow = dow[short]
  if (isoDow === undefined || isoDow === 3) return null // mercredi = jour mort, verrouillé
  return (2 - isoDow + 7) % 7 // mardi=0 (dernier jour), lundi=1, dimanche=2, ...
}

Deno.serve(async () => {
  const { data: game } = await supabase.from('photo_game').select('*').eq('id', 1).single()
  if (!game) return new Response('Pas de partie', { status: 200 })

  const daysLeft = daysUntilDeadline()
  if (daysLeft === null) return new Response('Jour mort (mercredi), pas de rappel', { status: 200 })

  let title = ''
  let notifBody = ''
  let tag = ''
  let missingUserIds: string[] = []

  if (game.status === 'active') {
    if (daysLeft === 0) {
      title = 'VITE, dernier jour !!'
      notifBody = "Dernier jour pour uploader ta photo du thème, avant minuit !"
      tag = 'photo-game-reminder-upload'
    } else if (daysLeft === 1) {
      title = "Plus qu'un jour pour upload..."
      notifBody = 'Il te reste un jour pour uploader ta photo du thème.'
      tag = 'photo-game-reminder-upload'
    } else {
      return new Response('Trop tôt pour un rappel', { status: 200 })
    }

    const { data: users } = await supabase.auth.admin.listUsers()
    const uploaded = new Set([game.photo_1_user_id, game.photo_2_user_id].filter(Boolean))
    missingUserIds = (users?.users ?? []).map((u) => u.id).filter((id) => !uploaded.has(id))

  } else if (game.status === 'voting') {
    if (daysLeft === 0) {
      title = 'VITE, viens voter !!'
      notifBody = 'Dernier jour pour voter sur Photo Duel, avant minuit !'
      tag = 'photo-game-reminder-vote'
    } else if (daysLeft === 1) {
      title = "Plus qu'un jour pour voter..."
      notifBody = 'Il te reste un jour pour voter sur Photo Duel.'
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
