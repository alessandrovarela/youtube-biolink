// Story 3.5 — Página pública `/[username]` via SSR (RSC).
// Path real é `/username` (o `@` do PRD é display-only — ver routing.md / Story 3.6).
// Leitura pública sem auth via client anônimo stateless (sem cookies) → permite ISR.
// [Source: architecture.md § 2.5 (routing), § 8.3 (workflow público), § 3.1 (cache)]
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase';
import { fetchPublicPage, type PublicProfile } from '@/lib/queries/public-page';

// Revalidação ISR a cada 60s (AC7). [Source: architecture.md § 3.1 Cache]
export const revalidate = 60;

interface PageProps {
  params: Promise<{ username: string }>;
}

/** Nome de exibição com fallback para `@username`. */
function displayNameOf(profile: PublicProfile): string {
  return profile.display_name?.trim() || `@${profile.username}`;
}

/** Iniciais para o avatar-fallback (até 2 letras). */
function initialsOf(profile: PublicProfile): string {
  const base = profile.display_name?.trim() || profile.username;
  const parts = base.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return letters.toUpperCase();
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
  const name = displayNameOf(profile);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center gap-6 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={`Avatar de ${name}`}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-200 text-2xl font-semibold text-neutral-600"
          >
            {initialsOf(profile)}
          </div>
        )}
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="text-sm text-neutral-500">@{profile.username}</p>
        {profile.bio && <p className="max-w-prose text-neutral-700">{profile.bio}</p>}
      </header>

      <nav className="flex w-full flex-col gap-3" aria-label="Links">
        {links.length === 0 ? (
          <p className="text-center text-sm text-neutral-400">Nenhum link por aqui ainda.</p>
        ) : (
          links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-center font-medium transition-colors hover:bg-neutral-50"
            >
              {link.title}
            </a>
          ))
        )}
      </nav>
    </main>
  );
}
