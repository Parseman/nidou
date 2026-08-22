import { supabase } from './supabase'

/**
 * Appelle une edge function de notification push (notify-*) avec le token
 * de la session courante. Échec silencieux et non-bloquant : une notif ratée
 * ne doit jamais casser l'action métier qui la déclenche.
 */
export async function callNotifyFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    /* non-bloquant */
  }
}
