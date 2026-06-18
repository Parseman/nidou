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

const ITEM_LABEL: Record<string, string> = {
  sword: 'Épée ⚔️',
  heart: 'Cœur 💛',
  shield: 'Bouclier 🛡️',
}

Deno.serve(async (req) => {
  let body: {
    type: string
    actor_name?: string
    item_type?: string
    action?: string
    damage?: number
    target_id?: string | null
  } = { type: '' }

  try { body = await req.json() } catch { /* pas de body */ }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')

  if (!subs?.length) return new Response('Aucun abonné', { status: 200 })

  let title = ''
  let notifBody = ''
  let tag = 'battle'
  let targets = subs

  if (body.type === 'item_spawned') {
    title = `🎁 Un objet est apparu sur Nidou !`
    notifBody = `${ITEM_LABEL[body.item_type ?? ''] ?? 'Objet'} — vite, récupère-le !`
    tag = 'battle-spawn'

  } else if (body.type === 'item_claimed') {
    title = `${ITEM_LABEL[body.item_type ?? ''] ?? 'Objet'} récupéré !`
    notifBody = `${body.actor_name ?? 'Ton partenaire'} a ramassé l'objet.`
    tag = 'battle-claim'

  } else if (body.type === 'battle_action') {
    // Notifier uniquement la cible si précisée
    if (body.target_id) {
      targets = subs.filter(s => s.user_id === body.target_id)
    }

    if (body.action === 'attack') {
      const dmg = body.damage ?? 0
      title = dmg > 0 ? `⚔️ Attaque ! -${dmg} PV !` : `🛡️ Attaque bloquée !`
      notifBody = `${body.actor_name ?? 'Ton partenaire'} t'a attaqué${dmg > 0 ? ` pour ${dmg} dégâts` : ', mais ton bouclier a tenu'}.`
    } else if (body.action === 'heal') {
      title = `💛 ${body.actor_name ?? 'Ton partenaire'} se soigne`
      notifBody = `Il récupère 1 PV.`
    } else if (body.action === 'shield') {
      title = `🛡️ ${body.actor_name ?? 'Ton partenaire'} active un bouclier !`
      notifBody = `Prépare-toi…`
    } else {
      title = `⚡ Action de combat !`
      notifBody = `${body.actor_name ?? 'Ton partenaire'} a agi.`
    }
    tag = 'battle-action'

  } else {
    return new Response('Type inconnu', { status: 400 })
  }

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
