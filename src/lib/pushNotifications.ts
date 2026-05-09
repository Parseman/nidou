import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export type PushResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'error'; message: string }

export async function registerPush(userId: string): Promise<PushResult> {
  if (!('Notification' in window)) {
    return { ok: false, reason: 'unsupported', message: "Ton navigateur ne supporte pas les notifications. Sur iPhone, ajoute l'app à l'écran d'accueil depuis Safari, puis réessaie." }
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported', message: "Les notifications push ne sont pas disponibles dans ce navigateur." }
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const permission = await Notification.requestPermission()
    if (permission === 'denied') {
      return { ok: false, reason: 'denied', message: "Notifications bloquées. Autorise-les dans les réglages du navigateur." }
    }
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied', message: "Permission refusée." }
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
    if (!vapidKey) {
      return { ok: false, reason: 'error', message: "Clé VAPID manquante dans .env (VITE_VAPID_PUBLIC_KEY)." }
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: json.endpoint, subscription: json },
      { onConflict: 'endpoint' }
    )
    if (error) {
      return { ok: false, reason: 'error', message: `Erreur Supabase : ${error.message}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, reason: 'error', message: String(err) }
  }
}
