// Story 2.9 — Auth guard via layout (architecture.md § 10.3.1).
// Protege toda a árvore /dashboard/*. Sem middleware.ts no MVP (Epic 6).
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/dashboard');
  }

  return <>{children}</>;
}
