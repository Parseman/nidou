import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { sendPushToAll } from '../_shared/webpush.ts'

const supabase = createSupabaseAdmin()

Deno.serve(async () => {
  // Date du jour en heure de Paris (format YYYY-MM-DD)
  const parisToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })

  // Utilisateurs qui ne se sont pas connectés aujourd'hui
  const { data: streaks } = await supabase
    .from('user_streaks')
    .select('user_id, streak')
    .lt('last_login_date', parisToday)

  if (!streaks?.length) {
    return new Response("Tout le monde est connecté aujourd'hui", { status: 200 })
  }

  const userIds = streaks.map((s) => s.user_id)

  // Subscriptions push des utilisateurs absents uniquement
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')
    .in('user_id', userIds)

  if (!subs?.length) {
    return new Response('Aucun abonné parmi les absents', { status: 200 })
  }

  await Promise.allSettled(
    subs.map(({ subscription, user_id }) => {
      const row = streaks.find((s) => s.user_id === user_id)
      const n = row?.streak ?? 1
      return sendPushToAll([{ subscription }], {
        title: '🔥 Ta flamme est en danger !',
        body: `Connecte-toi pour ne pas perdre ta série de ${n} jour${n > 1 ? 's' : ''} !`,
        tag: 'streak-reminder',
        renotify: true,
      })
    }),
  )

  return new Response(`Rappels streak envoyés (${subs.length} abonné(s))`, { status: 200 })
})
