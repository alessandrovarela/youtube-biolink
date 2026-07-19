import type { NextConfig } from 'next';

// Story 6.5 — Headers de segurança formais (NFR4).
//
// POR QUE AQUI E NÃO NO MIDDLEWARE:
// `headers()` do Next aplica os headers a TODAS as rotas no momento da resposta,
// sem custo de invocação edge e sem interferir no cache ISR. O middleware
// (middleware.ts) tem matcher cirúrgico em `/dashboard/:path*` — se a CSP
// morasse lá, `/`, `/login`, `/signup` e a página pública `/[username]` ficariam
// SEM headers de segurança. Separação: middleware = auth/sessão; next.config =
// headers. [Story 6.5 AC9 + nota de decisão]
//
// POR QUE SEM NONCE:
// Nonce exige um valor novo por request, o que torna a resposta não-cacheável.
// A página pública é ISR (`revalidate = 60`, NFR1) e headers estáticos não podem
// carregar nonce. Nonce por middleware cobriria só `/dashboard/*`, criando duas
// CSPs divergentes para manter. A story coloca nonce explicitamente fora do
// escopo quando a policy calibrada não precisa dele ("não inventar
// complexidade"). Consequência assumida: `script-src` usa 'unsafe-inline'.
// Ver docs/architecture/routing.md § 6 para o tradeoff completo.

const isDev = process.env.NODE_ENV === 'development';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

// Cada entrada documenta POR QUE é necessária — uma CSP sem justificativa
// apodrece: ninguém sabe o que dá para apertar depois.
const csp = [
  "default-src 'self'",

  // 'unsafe-inline': o App Router injeta o payload RSC via <script> inline
  // (self.__next_f.push) e o ThemeProvider (Story 4.3) renderiza um script
  // inline síncrono anti-flash. Sem nonce, ambos exigem unsafe-inline.
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
