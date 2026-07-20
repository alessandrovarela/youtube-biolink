// Story 2.9 — Auth guard via layout (architecture.md § 10.3.1).
// Protege toda a árvore /dashboard/*. No MVP era a ÚNICA barreira (sem arquivo de
// proxy/middleware na raiz). Desde a Story 6.5 o `proxy.ts` da raiz faz o mesmo guard
// na edge — este layout NÃO foi removido: as duas camadas somam (defense-in-depth,
// NFR3), e o layout é a autoritativa (mesmo runtime das queries). Ver proxy.ts.
// Story 4.2 — topbar/nav coeso (Perfil ↔ Links + logout) + container central
// respeitando --topbar-h e --max-dashboard.
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { DashboardNav } from '@/components/dashboard/nav';
import { ThemeProvider } from '@/components/dashboard/theme-provider';
import { resolveTheme } from '@/lib/theme';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  // Story 4.3 — tema inicial vem do perfil (fallback light em valor inválido/ausente).
  // Aplicado já no SSR (via script no ThemeProvider) para evitar flash.
  const { data: profile } = await supabase
    .from('profiles')
    .select('theme')
    .eq('id', user.id)
    .single();
  const initialTheme = resolveTheme((profile as { theme?: string } | null)?.theme);

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <div className="flex min-h-screen flex-col">
        <DashboardNav />
        <main className="mx-auto w-full max-w-[var(--max-dashboard)] flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
