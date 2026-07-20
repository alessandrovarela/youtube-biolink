// Story 3.5 — Página pública `/[username]` via SSR (RSC).
// Path real é `/username` (o `@` do PRD é display-only — ver routing.md / Story 3.6).
// Leitura pública sem auth via client anônimo stateless (sem cookies) → permite ISR.
// [Source: architecture.md § 2.5 (routing), § 8.3 (workflow público), § 3.1 (cache)]
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase';
import { fetchPublicPage, displayNameOf } from '@/lib/queries/public-page';
import { PublicProfileView } from '@/components/public/PublicProfileView';

// Revalidação ISR a cada 60s (AC7). [Source: architecture.md § 3.1 Cache]
export const revalidate = 60;

// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ POR QUE UM generateStaticParams QUE RETORNA LISTA VAZIA (DEBT-001)           │
// └──────────────────────────────────────────────────────────────────────────────┘
// Sem esta função, `revalidate = 60` acima é INERTE. Não é bug do Supabase, nem
// dos cookies, nem do proxy edge: no Next 16 uma rota com SEGMENTO DINÂMICO e
// SEM `generateStaticParams` é classificada como `ƒ` (Dynamic) no build e
// responde `Cache-Control: private, no-cache, no-store` — o `revalidate` do
// módulo nunca chega a ser considerado.
//
// Provado por experimento controlado (4 rotas-sonda, `next build` + `next start`):
//
//   rota-sonda                                        build      Cache-Control
//   ──────────────────────────────────────────────────────────────────────────
//   /probe            (segmento ESTÁTICO, revalidate)   ○ 1m      s-maxage=60, SWR
//   /probe/[slug]     (SEM generateStaticParams)        ƒ         no-store   ← nosso caso
//   /probe/[slug]     (COM generateStaticParams: [ ])   ●         s-maxage=60, SWR
//   /probe/[slug]     (COM generateStaticParams: seed)  ● 1m      s-maxage=60, SWR
//
// A sonda que reproduz o defeito NÃO toca em Supabase, cookies nem fetch — só o
// segmento dinâmico basta. Isso descarta todas as hipóteses anteriores.
//
// Retornamos LISTA VAZIA de propósito: não queremos prerenderizar username algum
// no build (a lista muda a cada cadastro e o build não deve depender do banco).
// Com `dynamicParams` no default (`true`), cada username é gerado SOB DEMANDA na
// primeira visita (`x-nextjs-cache: MISS`) e servido do cache nas seguintes
// (`HIT`), revalidando a cada 60s. É exatamente a NFR1.
//
// CONSEQUÊNCIAS ACEITAS (todas verificadas):
//  • Edições no dashboard aparecem na página pública em ATÉ 60s. É o contrato que
//    `revalidate = 60` sempre prometeu — antes ele só não estava sendo cumprido.
//  • Um 404 (`notFound()`) TAMBÉM é cacheado por até 60s. Não fica congelado:
//    expira e revalida como qualquer outra resposta. Um username recém-criado
//    pode responder 404 por, no máximo, 60s após alguém ter visitado a URL antes.
//  • O tracking de cliques NÃO é afetado: `TrackedLink` é client component e
//    chama a Server Action no clique real, fora do render cacheado.
//  • CSP: com o cache de fato existindo, um nonce por request voltaria a ser
//    incompatível com o HTML cacheado desta rota — ver next.config.ts.
// [Source: DEBT-001 · docs/architecture/technical-debt.md]
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = createPublicClient();
  const data = await fetchPublicPage(supabase, username);

  if (!data) {
    return { title: 'Perfil não encontrado' };
  }

  const { profile } = data;
  const name = displayNameOf(profile);
  const title = `${name} (@${profile.username})`;
  const description = profile.bio ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      // OG image placeholder no MVP; imagem definitiva em Phase 2 (AC6).
      images: [{ url: '/og-placeholder.png' }],
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = createPublicClient();
  const data = await fetchPublicPage(supabase, username);

  // Profile inexistente → 404 custom (app/[username]/not-found.tsx). AC5.
  if (!data) notFound();

  const { profile, links } = data;

  // Tema aplicado no ROOT da página server-side (SSR, RSC) → sem FOUC. A view
  // resolve `profile.theme` via resolveThemeClass e o injeta na classe do
  // container. [Story 4.4 AC1/AC2/AC4]
  return <PublicProfileView profile={profile} links={links} />;
}
