// Clients Supabase para o App Router (Story 2.4+).
// - createServerClient(): server-side com cookies (Server Components, Actions, Route Handlers).
// - createBrowserClient(): client-side (uso raro no MVP).
// Sem admin client no MVP (ver architecture.md § 2.2).
import {
  createServerClient as createSSRServerClient,
  createBrowserClient as createSSRBrowserClient,
} from '@supabase/ssr';
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
