// Story 4.2 — Topbar/nav coeso do dashboard.
// Fecha o débito da retro do Epic 3 ("a feature é alcançável?"): liga
// Perfil (/dashboard) ↔ Links (/dashboard/links) + logout, sempre visível.
// Layout derivado de docs/design/system/project/ui_kits/dashboard/index.html
// (--topbar-h, --max-dashboard). Client: usa usePathname para o estado ativo.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/auth/logout-button';
import { cn } from '@/lib/cn';

const tabs = [
  { href: '/dashboard', label: 'Perfil' },
  { href: '/dashboard/links', label: 'Links' },
  { href: '/dashboard/analytics', label: 'Analytics' },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur"
      style={{ height: 'var(--topbar-h)' }}
    >
      <div className="mx-auto flex h-full w-full max-w-[var(--max-dashboard)] items-center justify-between gap-4 px-6">
        <span className="font-bold tracking-tight">Biolink</span>

        <nav className="flex items-center gap-1 rounded-pill bg-muted p-1" aria-label="Seções">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-surface text-fg shadow-[var(--shadow-sm)]'
                    : 'text-muted-fg hover:text-fg'
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <LogoutButton />
      </div>
    </header>
  );
}
