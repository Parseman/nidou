import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Client Supabase avec la service role key — bypass RLS, réservé aux edge functions. */
export function createSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}
