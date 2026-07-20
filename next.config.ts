import type { NextConfig } from 'next';

// ┌────────────────────────────────────────────────────────────────────────────────┐
// │ GATE DE BUILD — envs obrigatórios em produção (issue #1 do gate da Wave 4)      │
// └────────────────────────────────────────────────────────────────────────────────┘
// A Story 6.4 colocou um `throw` no topo de lib/rate-limit.ts e a documentação afirmava
// que, sem RATE_LIMIT_PEPPER, "o app não sobe". O gate da Wave 4 TESTOU e a afirmação
// era FALSA: `next build` saía 0, o servidor subia, e `/`, `/login`, `/health` e
// `/[username]` respondiam 200 com log limpo. O erro só aparecia na primeira invocação
// REAL de uma Server Action — porque o Next carrega esses módulos SOB DEMANDA, não no
// boot. Consequência: um deploy mal provisionado ficava com TODOS os sinais verdes
// (build, deploy, homepage, página pública, /health) e SEM login. Nenhum smoke test
// pegaria — quem descobriria seria o usuário tentando entrar.
//
// POR QUE AQUI: `next.config.ts` é avaliado ANTES de qualquer compilação, tanto em
// `next build` quanto em `next start`. Um throw daqui:
//   • FALHA O BUILD → o artefato ruim nunca é gerado, então nunca embarca. É o único
//     ponto que efetivamente BARRA O DEPLOY (na Vercel, build vermelho = sem promoção).
//   • FALHA O BOOT de `next start` → o self-hosted também quebra alto, e agora a frase
//     "o app não sobe" é verdadeira de fato, e não só de intenção.
// O throw de lib/rate-limit.ts permanece como BACKSTOP redundante: se alguém remover
// este gate, o controle de segurança ainda não degrada em silêncio. Defense-in-depth
// aplicado a configuração, o mesmo princípio que o Epic 6 aplica a acesso.
//
// POR QUE NÃO NO MÓDULO QUE USA O ENV: porque o momento em que o env é LIDO (primeira
// Server Action) é tarde demais para impedir o deploy. A regra geral: valide
// configuração no ponto mais CEDO que consegue reprovar o artefato, não no ponto onde
// ela é consumida.
//
// DEVELOPMENT segue funcionando sem provisionamento: NODE_ENV=development não passa
// pelo gate, e lib/rate-limit.ts usa o fallback documentado com aviso único.
// [Source: gate Wave 4 issue #1 · Story 6.4 AC9/AC10]

/** Envs SEM os quais um build de produção não deve existir. Não inventar outros. */
const REQUIRED_PRODUCTION_ENV = [
  {
    name: 'RATE_LIMIT_PEPPER',
    why:
      'sem ele o subject dos buckets de auth é sha256(":"+ip) — computável por ' +
      'qualquer um — e um atacante nega login a IPs arbitrários (lockout).',
    how: 'openssl rand -hex 32 · server-only, NUNCA NEXT_PUBLIC_* · valor distinto por ambiente',
  },
] as const;

function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_PRODUCTION_ENV.filter(
    (entry) => !(process.env[entry.name] ?? '').trim()
  );
  if (missing.length === 0) return;

  throw new Error(
    '\n[env-gate] BUILD DE PRODUÇÃO ABORTADO — env obrigatório ausente.\n\n' +
      missing
        .map((entry) => `  ✗ ${entry.name}\n      por quê: ${entry.why}\n      como: ${entry.how}`)
        .join('\n') +
      '\n\nProvisione em production E preview (Vercel → Settings → Environment ' +
      'Variables) e rode o build de novo. Este gate existe para que um deploy mal ' +
      'provisionado FALHE AQUI, e não meses depois com todos os health checks verdes ' +
      'e o login retornando 500.\n'
  );
}

assertProductionEnv();

// Story 6.5 — Headers de segurança formais (NFR4).
//
// POR QUE AQUI E NÃO NO PROXY EDGE:
// `headers()` do Next aplica os headers a TODAS as rotas no momento da resposta,
// sem custo de invocação edge e sem interferir no cache ISR. O proxy edge
// (proxy.ts) tem matcher cirúrgico em `/dashboard/:path*` — se a CSP morasse lá,
// `/`, `/login`, `/signup` e a página pública `/[username]` ficariam SEM headers
// de segurança. Separação: proxy = auth/sessão; next.config = headers.
// [Story 6.5 AC9 + nota de decisão]
//
// ┌────────────────────────────────────────────────────────────────────────────────┐
// │ POR QUE SEM NONCE — O TRADEOFF SE INVERTEU COM A CORREÇÃO DO DEBT-001 (TD-2)    │
// └────────────────────────────────────────────────────────────────────────────────┘
// O gate do Epic 6 registrou (TD-2) que a justificativa "nonce quebraria o cache"
// era falsa, PORQUE naquele momento `/[username]` respondia `no-store` — não havia
// cache para quebrar. A recomendação era reavaliar quando o DEBT-001 fosse
// resolvido. Ele FOI resolvido (ver app/[username]/page.tsx), e a reavaliação
// inverte a conclusão: agora o argumento do cache é VERDADEIRO, e mais forte do
// que se supunha.
//
// A razão é estrutural, não de conveniência. Um nonce só protege se for
// IMPREVISÍVEL E ÚNICO POR REQUEST. Sob ISR:
//   • O HTML é renderizado UMA vez e servido do cache por até 60s. O nonce fica
//     ASSADO nos `<script nonce="…">` do HTML cacheado.
//   • Se o header CSP fosse gerado por request (nonce novo a cada visita), ele não
//     casaria com o nonce assado no HTML → TODO script bloqueado, página quebrada.
//   • Se o header viesse do cache junto com o HTML, o nonce seria uma CONSTANTE
//     pública compartilhada por todos os visitantes durante a janela de 60s — o que
//     é PIOR que não ter nonce: aparenta mitigação e não mitiga nada.
// Ou seja, na superfície que mais importa (`/[username]`, a única que renderiza
// conteúdo controlado por terceiros), nonce e ISR são mutuamente exclusivos.
//
// RESTARIA aplicar nonce só a `/dashboard/*`, que é dinâmico. Foi avaliado e
// RECUSADO, por três razões medidas e não por preguiça:
//   1. Exigiria DUAS policies divergentes (uma estática aqui, uma dinâmica no
//      proxy). O browser intersecta CSPs múltiplas, então funcionaria — ao custo
//      de duas fontes de verdade que apodrecem em ritmos diferentes.
//   2. O `/dashboard/*` está atrás de autenticação e NÃO renderiza HTML de
//      terceiros: todo conteúdo de usuário passa por escape do React. O único
//      `dangerouslySetInnerHTML` do projeto (components/dashboard/theme-provider)
//      injeta um literal do próprio código, com a classe de tema serializada por
//      `JSON.stringify` — não há caminho de dado do usuário para dentro dele.
//   3. Logo, o nonce protegeria a superfície de MENOR exposição, e continuaria
//      impossível na de MAIOR.
//
// O PREÇO, dito sem eufemismo e sem mudança desde a Story 6.5: `script-src
// 'unsafe-inline'` NÃO mitiga XSS — um `<script>` injetado executa. O ganho real
// desta CSP está nos OUTROS diretivos (`object-src 'none'`, `base-uri 'self'`,
// `form-action 'self'`, `frame-ancestors 'none'`, `connect-src` restrito), que não
// dependem do nonce. Contra o baseline — ausência TOTAL de CSP — é ganho líquido.
//
// O QUE DESTRAVARIA A DECISÃO (para quem revisitar): CSP baseada em HASH em vez de
// nonce. Hashes são estáveis entre requests, então convivem com ISR. Hoje não é
// viável porque o payload RSC inline (`self.__next_f.push`) muda a cada build E a
// cada conteúdo renderizado — o hash mudaria por usuário. Se o Next passar a
// expor os hashes dos seus scripts inline, esta decisão deve ser reaberta.
// Ver docs/architecture/routing.md § 6.4 para o histórico do tradeoff.

const isDev = process.env.NODE_ENV === 'development';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

// Cada entrada documenta POR QUE é necessária — uma CSP sem justificativa
// apodrece: ninguém sabe o que dá para apertar depois.
const csp = [
  "default-src 'self'",

  // 'unsafe-inline': o App Router injeta o payload RSC via <script> inline
  // (self.__next_f.push) e o ThemeProvider (Story 4.3) renderiza um script
  // inline síncrono anti-flash. Ambos são scripts inline: SEM NONCE eles exigem
  // 'unsafe-inline'. Não usamos nonce porque ele é incompatível com o ISR de
  // `/[username]` — ver o bloco TD-2 no cabeçalho para a análise completa.
  // 'unsafe-eval': só em dev — react-refresh/HMR do Next avalia código.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,

  // 'unsafe-inline': Tailwind 4 + next/font injetam <style> inline, e vários
  // componentes usam style={{...}} (Avatar, nav, theme-selector), que o React
  // serializa como atributo style= no SSR — bloqueado por style-src-attr.
  "style-src 'self' 'unsafe-inline'",

  // https: é OBRIGATÓRIO: profile.avatar_url é uma URL arbitrária fornecida
  // pelo usuário, renderizada em <img> puro (components/ui/Avatar.tsx). Sem
  // https: todo avatar externo quebra silenciosamente no browser.
  "img-src 'self' data: blob: https:",

  // next/font/google faz self-host no build → serve de /_next/static.
  "font-src 'self' data:",

  // Supabase: REST/Auth (https) e Realtime (wss). ws:/http: locais só em dev,
  // para o HMR do Next.
  `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^https:/, 'wss:')}${
    isDev ? ' ws: http://localhost:*' : ''
  }`.trim(),

  // Anti-clickjacking (par moderno do X-Frame-Options).
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Impede que um <base> injetado sequestre URLs relativas.
  "base-uri 'self'",
  // Impede que um form injetado poste credenciais para fora.
  "form-action 'self'",
]
  .join('; ')
  .concat(isDev ? '' : '; upgrade-insecure-requests');

const securityHeaders = [
  // Enforce, não Report-Only — Report-Only não cumpre NFR4 (AC8).
  { key: 'Content-Security-Policy', value: csp },
  // Redundante com frame-ancestors, mantido para browsers antigos.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // HSTS NÃO é definido aqui: a Vercel já aplica Strict-Transport-Security em
  // produção. Duplicar só cria duas fontes de verdade. [AC10]
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
