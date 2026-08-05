import { supabase } from './supabase'

// Crédite (ou débite) la bourse individuelle d'un utilisateur de façon atomique.
// Non-bloquant : les appelants ne l'attendent généralement pas (fire-and-forget).
export async function awardCoins(userId: string, amount: number): Promise<void> {
  try {
    await supabase.rpc('award_coins', { p_user_id: userId, p_amount: amount })
  } catch { /* non-bloquant */ }
}
