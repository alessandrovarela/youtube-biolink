// Story 2.9 — Auth guard via layout (architecture.md § 10.3.1).
// Protege toda a árvore /dashboard/*. Sem middleware.ts no MVP (Epic 6).
// Story 4.2 — topbar/nav coeso (Perfil ↔ Links + logout) + container central
// respeitando --topbar-h e --max-dashboard.
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { DashboardNav } from '@/components/dashboard/nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav />
      <main className="mx-auto w-full max-w-[var(--max-dashboard)] flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
