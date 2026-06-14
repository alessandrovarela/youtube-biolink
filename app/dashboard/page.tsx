// Story 2.10 — Dashboard de perfil. Protegido pelo auth guard do layout (2.9).
import { createServerClient } from '@/lib/supabase';
import { ProfileForm, type ProfileData } from '@/components/dashboard/profile-form';
import { LogoutButton } from '@/components/auth/logout-button';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // user é garantido pelo layout guard; fallback defensivo para o tipo.
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_url')
    .eq('id', user!.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Seu perfil</h1>
        <LogoutButton />
      </div>
      {profile && <ProfileForm profile={profile as ProfileData} />}
    </main>
  );
}
