// Story 2.10 — Dashboard de perfil. Protegido pelo auth guard do layout (2.9).
// Story 4.2 — nav/logout movidos para a topbar do layout; perfil em Card.
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { ProfileForm, type ProfileData } from '@/components/dashboard/profile-form';
import { Card } from '@/components/ui/Card';

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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Seu perfil</h1>
      {profile && (
        <Card>
          <ProfileForm profile={profile as ProfileData} />
        </Card>
      )}
    </div>
  );
}
