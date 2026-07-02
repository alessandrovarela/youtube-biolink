// Story 4.4 — View presentacional da página pública `/[username]`.
// Extraída da RSC (app/[username]/page.tsx) para ser testável em isolamento (RTL)
// e para carregar a classe de tema no ROOT da página server-side (SSR, sem FOUC).
//
// O tema mora no <html> apenas no dashboard (Story 4.3). Aqui, o <html> do root
// layout NÃO conhece o tema do dono, então aplicamos `resolveThemeClass(theme)`
// num container próprio — os seletores `.theme-*` em globals.css (Story 4.4)
// redefinem os tokens nesse escopo e as utilities `bg-bg`/`text-fg`/… resolvem.
// Composição visual alinhada ao ui_kit public-profile (fonte de verdade).
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { resolveThemeClass } from '@/lib/theme';
import { TrackedLink } from '@/components/public/TrackedLink';
import {
  displayNameOf,
  type PublicLink,
  type PublicProfile,
} from '@/lib/queries/public-page';

export interface PublicProfileViewProps {
  profile: PublicProfile;
  links: PublicLink[];
}

export function PublicProfileView({ profile, links }: PublicProfileViewProps) {
  const name = displayNameOf(profile);
  const themeClass = resolveThemeClass(profile.theme);

  return (
    <div
      data-testid="public-theme-root"
      data-theme={profile.theme ?? 'light'}
      className={cn('min-h-screen bg-bg text-fg', themeClass)}
    >
      <main className="mx-auto flex min-h-screen max-w-[var(--max-public)] flex-col items-center gap-3 px-6 pb-12 pt-16 text-center">
        <Avatar
          src={profile.avatar_url}
          displayName={name}
          size={96}
          alt={`Avatar de ${name}`}
          className="mb-3 border border-border"
        />

        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        <p className="font-mono text-sm text-muted-fg">@{profile.username}</p>
        {profile.bio && <p className="mt-2 max-w-[360px] text-[15px] leading-6">{profile.bio}</p>}

        <nav className="mt-6 flex w-full flex-col gap-3" aria-label="Links">
          {links.length === 0 ? (
            <p className="text-sm text-muted-fg">Nenhum link por aqui ainda.</p>
          ) : (
            links.map((link) => <TrackedLink key={link.id} link={link} />)
          )}
        </nav>

        <footer className="mt-10 text-xs text-muted-fg">
          Feito com <span className="font-semibold text-fg">biolink</span>
        </footer>
      </main>
    </div>
  );
}
