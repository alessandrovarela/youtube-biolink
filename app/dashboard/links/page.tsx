// Story 3.3 — Página de gestão de links. Protegida pelo auth guard do layout (2.9).
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { LinksManager } from '@/components/dashboard/links-manager';
import type { Link } from '@/lib/types';

export default async function LinksPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guard defensivo: layout e page renderizam concorrentemente no App Router.
  if (!user) redirect('/login?next=/dashboard/links');

  const { data: links } = await supabase
    .from('links')
    .select('*')
    .eq('profile_id', user.id)
    .order('position', { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Seus links</h1>
        <a href="/dashboard" className="text-sm text-gray-600 underline">
          Voltar ao perfil
        </a>
      </div>
      <LinksManager initialLinks={(links ?? []) as Link[]} />
    </main>
  );
}
