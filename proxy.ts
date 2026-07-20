// Story 6.5 — Proxy edge: auth guard + refresh proativo de token.
//
// NOME DO ARQUIVO (TD-6): era `middleware.ts`. O Next 16 renomeou a convenção para
// `proxy.ts` e emitia um aviso de depreciação em todo build/dev. A migração é um
// RENAME PURO — mesmo matcher, mesma lógica, mesmo guard, mesmo refresh de token —
// e a única mudança de código é o nome do export (`middleware` → `proxy`), que o
// Next exige casar com o nome do arquivo. Nenhuma diferença de comportamento.
//
// TRÊS PONTOS DE DESIGN QUE NÃO SÃO ACIDENTAIS:
//
// 1. MATCHER POSITIVO E ENUMERADO (`/dashboard/:path*`), nunca o catch-all com
//    negative lookahead da doc do Next. Aqui a página pública é um SEGMENTO RAIZ
//    DINÂMICO (`app/[username]/page.tsx`) — um matcher permissivo a captura, o
//    que (a) transformaria a resposta ISR (`revalidate = 60`) em dinâmica,
//    ferindo NFR1, e (b) cobraria invocação edge em toda request pública.
//    Enumerar o que ENTRA é seguro; excluir o que sai não é.
//    Desde a correção do DEBT-001 esse risco deixou de ser teórico: `/[username]`
//    é `●` (ISR) de fato, e um matcher permissivo a devolveria para `ƒ`.
//    [Story 6.5 AC4/AC5 · docs/architecture/routing.md]
//
// 2. ESTE GUARD SOMA, NÃO SUBSTITUI. `app/dashboard/layout.tsx` continua com
//    `getUser()` + `redirect()`. O middleware é rápido e barato mas roda na edge
//    e depende do matcher estar correto; o layout é autoritativo (mesmo runtime
//    das queries). Defense-in-depth: nenhuma camada isolada basta. [AC3 · NFR3]
//
// 3. HEADERS DE SEGURANÇA NÃO MORAM AQUI. Ficam em `next.config.ts` (`headers()`),
//    que cobre TODAS as rotas — inclusive a pública ISR e os assets — sem custo
//    de invocação edge. Pôr CSP no middleware limitaria os headers ao matcher,
//    deixando `/`, `/login` e `/[username]` descobertos. [AC9 · ver next.config.ts]
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function proxy(request: NextRequest) {
  // O response é REATRIBUÍDO dentro de setAll (não mutado): o padrão do
  // @supabase/ssr exige recriar o NextResponse a partir do request já com os
  // cookies novos, senão o token renovado não chega ao browser nem ao RSC.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // 1) atualiza o request para que o render subsequente já veja a sessão nova
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // 2) recria o response a partir do request atualizado
        response = NextResponse.next({ request });
        // 3) propaga os Set-Cookie para o browser
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() valida o JWT contra o Auth server E dispara o refresh quando o
  // access token está perto de expirar — é a chamada que fecha a AC5 deferida
  // da Story 2.9. getSession() NÃO serve aqui: não revalida nem renova.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL('/login', request.url);
    // Preserva o destino para o pós-login, espelhando o guard de layout.
    // Desde o TD-7 este parâmetro é EFETIVAMENTE CONSUMIDO: `/login` o repassa ao
    // form e a action `signIn` redireciona para lá após autenticar, validando o
    // valor com `safeNextPath` (lib/validation/next-path.ts). Antes disso ele era
    // gerado e ignorado — o usuário sempre caía em `/dashboard`.
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Positivo e enumerado. `/dashboard/:path*` cobre `/dashboard` e toda a
  // subárvore. NÃO adicionar padrões catch-all: ver nota 1 acima.
  matcher: ['/dashboard/:path*'],
};
