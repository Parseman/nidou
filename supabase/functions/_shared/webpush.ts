import webpush from 'npm:web-push@3'

webpush.setVapidDetails(
  'mailto:contact@nidou.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

export { webpush }

export type PushTarget = { subscription: webpush.PushSubscription }

/** Envoie un payload JSON à une liste d'abonnés ; les échecs individuels sont ignorés. */
export async function sendPushToAll(targets: PushTarget[], payload: object): Promise<void> {
  await Promise.allSettled(
    targets.map((t) =>
      webpush.sendNotification(t.subscription, JSON.stringify(payload)).catch(() => null),
    ),
  )
}
