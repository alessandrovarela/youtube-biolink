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
import {
  displayNameOf,
  type PublicLink,
  type PublicProfile,
} from '@/lib/queries/public-page';

export interface PublicProfileViewProps {
  profile: PublicProfile;
  links: PublicLink[];
}

/** Seta de "link externo" (mesmo glifo do ui_kit public-profile). */
function LinkArrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-muted-fg"
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
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
            links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-[18px] py-[14px] font-medium text-fg shadow-[var(--shadow-sm)] transition-[transform,box-shadow,background] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:scale-[0.99]"
              >
                <span className="text-[15px]">{link.title}</span>
                <LinkArrow />
              </a>
            ))
          )}
        </nav>

        <footer className="mt-10 text-xs text-muted-fg">
          Feito com <span className="font-semibold text-fg">biolink</span>
        </footer>
      </main>
    </div>
  );
}
