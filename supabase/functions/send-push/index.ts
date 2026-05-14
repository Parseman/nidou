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
    (subs as Sub[]).map((row) => webpush.sendNotification(row.subscription, JSON.stringify(payload)))
  )
}

async function notifyUser(userId: string, payload: object) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
  if (!subs?.length) return
  await Promise.allSettled(
    (subs as Sub[]).map((row) => webpush.sendNotification(row.subscription, JSON.stringify(payload)))
  )
}

Deno.serve(async (req) => {
  const { type, table, record, old_record } = await req.json()

  if (table === 'messages') {
    await notifyAllExcept(record.sender_id, {
      title: `💬 ${record.sender_name}`,
      body: record.content,
      tag: 'message',
    })
  } else if (table === 'challenges') {
    if (type === 'INSERT') {
      const emoji: Record<string, string> = { easy: '🟢', medium: '🔵', hard: '🟣', legendary: '🟡' }
      await notifyAllExcept(record.created_by, {
        title: `${emoji[record.difficulty] ?? '⚡'} Nouveau défi de ${record.creator_name} !`,
        body: record.title,
        tag: 'challenge-new',
      })
    } else if (type === 'UPDATE') {
      const oldStatus = old_record?.status
      const newStatus = record.status

      if (oldStatus !== 'proof_submitted' && newStatus === 'proof_submitted') {
        await notifyUser(record.created_by, {
          title: '📸 Preuve reçue !',
          body: `${record.completer_name} a relevé ton défi "${record.title}"`,
          tag: 'challenge-proof',
        })
      } else if (oldStatus === 'proof_submitted' && (newStatus === 'validated' || newStatus === 'rejected')) {
        const accepted = newStatus === 'validated'
        await notifyUser(record.completed_by, {
          title: accepted ? '✅ Défi validé !' : '❌ Défi refusé',
          body: accepted
            ? `${record.validator_name} a validé ta preuve pour "${record.title}" !`
            : `${record.validator_name} n'a pas validé ta preuve pour "${record.title}"`,
          tag: 'challenge-result',
        })
      }
    }
  } else if (table === 'artworks') {
    await notifyAllExcept(record.sender_id, {
      title: `🎨 ${record.sender_name} t'a envoyé un dessin !`,
      body: "Ouvre Nidou pour le découvrir ✨",
      tag: 'artwork',
    })
  } else if (table === 'room_purchases') {
    const name = record.buyer_name ?? 'Quelqu\'un'
    await notifyAllExcept(record.buyer_id, {
      title: `🏠 ${name} a amélioré sa chambre !`,
      body: `${record.item_label} — ${record.cost} pièces dépensées 🪙`,
      tag: 'room-purchase',
    })
  }

  return new Response('OK', { status: 200 })
})
