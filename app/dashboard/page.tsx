// Story 2.10 — Dashboard de perfil. Protegido pelo auth guard do layout (2.9).
import { redirect } from 'next/navigation';
import NextLink from 'next/link';
import { createServerClient } from '@/lib/supabase';
import { ProfileForm, type ProfileData } from '@/components/dashboard/profile-form';
import { LogoutButton } from '@/components/auth/logout-button';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check próprio: layout e page renderizam concorrentemente no App Router, então
  // o redirect do layout guard não impede esta page de executar. Guard defensivo aqui também.
  if (!user) redirect('/login?next=/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_url')
    .eq('id', user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Seu perfil</h1>
        <LogoutButton />
      </div>
      <NextLink
        href="/dashboard/links"
        className="inline-flex w-fit items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
      >
        Gerenciar meus links →
      </NextLink>
      {profile && <ProfileForm profile={profile as ProfileData} />}
    </main>
  );
}
