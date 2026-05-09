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

type Sub = { subscription: webpush.PushSubscription }

async function notifyAllExcept(excludeUserId: string, payload: object) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .neq('user_id', excludeUserId)

  if (!subs?.length) return

  await Promise.allSettled(
    (subs as Sub[]).map((row) =>
      webpush.sendNotification(row.subscription, JSON.stringify(payload))
    )
  )
}

Deno.serve(async (req) => {
  const { table, record } = await req.json()

  if (table === 'messages') {
    await notifyAllExcept(record.sender_id, {
      title: `💬 ${record.sender_name}`,
      body: record.content,
      tag: 'message',
    })
  } else if (table === 'challenges') {
    const emoji: Record<string, string> = {
      easy: '🟢', medium: '🔵', hard: '🟣', legendary: '🟡',
    }
    await notifyAllExcept(record.created_by, {
      title: `${emoji[record.difficulty] ?? '⚡'} Nouveau défi de ${record.creator_name} !`,
      body: record.title,
      tag: 'challenge',
    })
  }

  return new Response('OK', { status: 200 })
})
