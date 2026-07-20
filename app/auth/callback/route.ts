// Story 2.5 — callback de confirmação de e-mail (code flow, architecture.md § 8.1).
// Story 6.5 / Epic 6 — endurecimento da validação de `next` (issue #6 do gate da Wave 4).
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// A implementação de `safeNextPath` mora em `lib/validation/next-path.ts` desde que
// o login passou a consumir `?next=` também (TD-7) — uma única função de validação
// para os dois consumidores. Reexportada aqui porque este continua sendo o ponto de
// entrada histórico (e o que os testes da Story 6.5 importam).
export { safeNextPath } from '@/lib/validation/next-path';
import { safeNextPath } from '@/lib/validation/next-path';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // `next` permite rotear pós-troca do code (ex.: recovery → nova senha).
  const safeNext = safeNextPath(searchParams.get('next'), origin);

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext ?? '/login?confirmed=1'}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/confirm-failed`);
}
