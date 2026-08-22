import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { sendPushToAll } from '../_shared/webpush.ts'

const supabase = createSupabaseAdmin()

async function notifyAllExcept(excludeUserId: string, payload: object) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .neq('user_id', excludeUserId)
  if (!subs?.length) return
  await sendPushToAll(subs, payload)
}

async function notifyUser(userId: string, payload: object) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
  if (!subs?.length) return
  await sendPushToAll(subs, payload)
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
  }

  return new Response('OK', { status: 200 })
})
