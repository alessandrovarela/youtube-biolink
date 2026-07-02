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
