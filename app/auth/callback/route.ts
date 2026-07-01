// Story 2.5 — callback de confirmação de e-mail (code flow, architecture.md § 8.1).
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // `next` permite rotear pós-troca do code (ex.: recovery → nova senha).
  // Só aceitamos paths locais (começam com `/`, não `//`) — evita open-redirect.
  const next = searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext ?? '/login?confirmed=1'}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/confirm-failed`);
}
