// Admin client para testes de integração de auth.
// Usa SERVICE_ROLE_KEY para criar/limpar usuários sem disparar e-mail nem
// esbarrar em rate limits. O service role NÃO é usado pela aplicação no MVP
// (ver architecture.md § 2.2) — é exclusivo de setup/teardown de testes.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** True quando há credenciais de service role + URL no ambiente. */
export function hasServiceRole(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Cria um client com privilégio de service role (bypassa qualquer RLS futura). */
export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Cria um client anônimo (anon key) — simula o acesso público da aplicação. */
export function createAnonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
