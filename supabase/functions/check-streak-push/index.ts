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
      return webpush
        .sendNotification(
          subscription,
          JSON.stringify({
            title: '🔥 Ta flamme est en danger !',
            body: `Connecte-toi pour ne pas perdre ta série de ${n} jour${n > 1 ? 's' : ''} !`,
            tag: 'streak-reminder',
            renotify: true,
          }),
        )
        .catch(() => null)
    }),
  )

  return new Response(`Rappels streak envoyés (${subs.length} abonné(s))`, { status: 200 })
})
