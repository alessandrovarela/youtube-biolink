// Clients Supabase para o App Router (Story 2.4+).
// - createServerClient(): server-side com cookies (Server Components, Actions, Route Handlers).
// - createBrowserClient(): client-side (uso raro no MVP).
// - createPublicClient(): server-side stateless (anon, sem cookies) para leitura
//   pública sem sessão (Story 3.5). Não lê cookies → não força render dinâmico,
//   permitindo ISR/`revalidate` na página pública `/[username]`.
// Sem admin client no MVP (ver architecture.md § 2.2).
import {
  createServerClient as createSSRServerClient,
  createBrowserClient as createSSRBrowserClient,
} from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRServerClient(URL, ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component (sem permissão de escrita de cookie).
          // Seguro ignorar: a renovação de sessão ocorre em Server Actions/Route Handlers.
        }
      },
    },
  });
}

export function createBrowserClient() {
  return createSSRBrowserClient(URL, ANON_KEY);
}

/**
 * Client anônimo stateless (sem cookies/sessão), para leitura pública server-side.
 * Usado pela página pública `/[username]` (Story 3.5): como não lê cookies, a rota
 * não é forçada a render dinâmico e pode ser cacheada via `revalidate = 60`.
 * A autorização é app-layer; a leitura pública só expõe dados públicos (§ 8.3).
 */
export function createPublicClient() {
  return createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
