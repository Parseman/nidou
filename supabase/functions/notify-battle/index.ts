import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { sendPushToAll } from '../_shared/webpush.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createSupabaseAdmin()

const ITEM_LABEL: Record<string, string> = {
  sword: 'Épée ⚔️',
  heart: 'Cœur 💛',
  shield: 'Bouclier 🛡️',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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

  if (!subs?.length) return new Response('Aucun abonné', { status: 200, headers: corsHeaders })

  let title = ''
  let notifBody = ''
  let tag = 'battle'
  let targets = subs

  if (body.type === 'item_spawned') {
    title = 'Item apparu'
    notifBody = `${ITEM_LABEL[body.item_type ?? ''] ?? 'Un objet'} vient d'apparaître ! Récupère-le avant l'autre.`
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
    return new Response('Type inconnu', { status: 400, headers: corsHeaders })
  }

  await sendPushToAll(targets, { title, body: notifBody, tag })

  return new Response(`"${body.type}" envoyé (${targets.length})`, { status: 200, headers: corsHeaders })
})
