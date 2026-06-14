// Landing: roteia por autenticação (architecture.md § 10.3).
// Logado → /dashboard; anônimo → /login. Destino do redirect pós-logout (Story 2.8).
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';

export default async function Home() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/dashboard' : '/login');
}
