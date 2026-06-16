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

type Sub = { subscription: webpush.PushSubscription; user_id: string }
type Challenge = { id: string; title: string; status: string; created_by: string }

// Prix minimum parmi tous les articles de la boutique chambre
const ROOM_SHOP_MIN_PRICE = 2500

Deno.serve(async (req) => {
  // Mode check coins uniquement (appelé par pg_cron séparé)
  let body: Record<string, string> = {}
  try { body = await req.json() } catch { /* pas de body */ }
  if (body?.check === 'coins') {
    const { data: settings } = await supabase
      .from('couple_settings').select('coins').eq('id', 1).single()
    if (settings && settings.coins >= ROOM_SHOP_MIN_PRICE) {
      const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
      if (subs?.length) {
        await Promise.allSettled(
          (subs as { subscription: webpush.PushSubscription }[]).map(({ subscription }) =>
            webpush.sendNotification(subscription, JSON.stringify({
              title: '🏠 Ta chambre t\'attend !',
              body: `Vous avez ${settings.coins} pièces — assez pour améliorer votre chambre ✨`,
              tag: 'room-upgrade-reminder',
            })).catch(() => null)
          )
        )
      }
    }
    return new Response('ok', { status: 200 })
  }
  // Jour courant en heure de Paris
  const parisDay = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Europe/Paris' })
  const isCreationWindow = ['Monday', 'Tuesday', 'Wednesday'].includes(parisDay)

  const { data: challenges } = await supabase
    .from('challenges')
    .select('id, title, status, created_by')
    .in('status', ['pending', 'proof_submitted'])

  if (!challenges?.length) {
    // Aucun défi actif — rappeler de lancer un défi pendant la fenêtre lun-mer
    if (!isCreationWindow) return new Response('Aucun défi en cours', { status: 200 })
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
    if (subs?.length) {
      await Promise.allSettled(
        (subs as { subscription: webpush.PushSubscription }[]).map(({ subscription }) =>
          webpush.sendNotification(subscription, JSON.stringify({
            title: '🏆 Pas de défi cette semaine !',
            body: 'Lancez un défi du début de semaine pour pimenter les choses ✨',
            tag: 'no-challenge-reminder',
          })).catch(() => null)
        )
      )
    }
    return new Response('Rappel no-challenge envoyé', { status: 200 })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')

  if (!subs?.length) {
    return new Response('Aucun abonné', { status: 200 })
  }

  const results: Promise<unknown>[] = []

  for (const sub of subs as Sub[]) {
    const userId = sub.user_id

    // Défis que cet utilisateur doit relever (pending, il n'est pas le créateur)
    const toComplete = (challenges as Challenge[]).filter(
      (c) => c.status === 'pending' && c.created_by !== userId
    )
    // Défis que cet utilisateur doit valider (preuve soumise, il est le créateur)
    const toValidate = (challenges as Challenge[]).filter(
      (c) => c.status === 'proof_submitted' && c.created_by === userId
    )

    if (toComplete.length === 0 && toValidate.length === 0) continue

    let title: string
    let body: string

    if (toComplete.length > 0 && toValidate.length > 0) {
      title = `⏰ Défis en attente`
      body =
        toComplete.map((c) => `🎯 À relever : ${c.title}`).join('\n') +
        '\n' +
        toValidate.map((c) => `📸 À valider : ${c.title}`).join('\n')
    } else if (toComplete.length > 0) {
      title = `🎯 Défi${toComplete.length > 1 ? 's' : ''} à relever !`
      body = toComplete.map((c) => `• ${c.title}`).join('\n')
    } else {
      title = `📸 Preuve à valider !`
      body = toValidate.map((c) => `• ${c.title}`).join('\n')
    }

    results.push(
      webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, tag: 'reminder' }))
    )
  }

  await Promise.allSettled(results)

  return new Response(`Rappels envoyés (${results.length} abonné(s) notifié(s))`, { status: 200 })
})
