// Story 3.5 — teste de integração da query pública `/[username]`.
// Requer SERVICE_ROLE_KEY (criar usuários/profiles + cleanup). Sem o secret, skipa
// (mesmo padrão de profiles.test.ts / links.test.ts).
//
// Testa a função `fetchPublicPage` (lib/queries/public-page.ts) contra o dev:
// - username válido → só links is_active=true do profile correto, ordenados por position;
// - lookup case-insensitive (citext, Story 2.1);
// - username inexistente → null (o page traduz em notFound() / 404).
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';
import { fetchPublicPage } from '@/lib/queries/public-page';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[public-page.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de integração da página pública skipado.'
  );
}

suite('Story 3.5 — query da página pública /[username]', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  // Client anônimo (anon key) — o mesmo perfil de acesso do createPublicClient().
  const anon = hasServiceRole() ? createAnonClient() : null;
  const createdUserIds: string[] = [];

  /** Cria um auth.user (profile via trigger) e retorna { id, username }. */
  async function createUserWithProfile(): Promise<{ id: string; username: string }> {
    const u = uniqueTestUser();
    const { data, error } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    createdUserIds.push(id);
    return { id, username: u.username };
  }

  afterAll(async () => {
    if (admin && createdUserIds.length) {
      // ON DELETE CASCADE remove profiles e links dos usuários de teste.
      await deleteTestUsers(admin, createdUserIds);
    }
  });

  it('retorna só links ativos do profile correto, ordenados por position', async () => {
    const { id: profileId, username } = await createUserWithProfile();
    const other = await createUserWithProfile();

    await admin!.from('links').insert([
      { profile_id: profileId, title: 'Terceiro', url: 'https://c.example.com', position: 2, is_active: true },
      { profile_id: profileId, title: 'Primeiro', url: 'https://a.example.com', position: 0, is_active: true },
      { profile_id: profileId, title: 'Inativo', url: 'https://x.example.com', position: 1, is_active: false },
      { profile_id: profileId, title: 'Segundo', url: 'https://b.example.com', position: 1, is_active: true },
      // Link de outro profile — não deve vazar.
      { profile_id: other.id, title: 'De outro', url: 'https://z.example.com', position: 0, is_active: true },
    ]);

    const data = await fetchPublicPage(anon!, username);

    expect(data).not.toBeNull();
    expect(data!.profile.username).toBe(username);
    // Só os 3 ativos, na ordem de position; o inativo e o de outro profile ficam fora.
    expect(data!.links.map((l) => l.title)).toEqual(['Primeiro', 'Segundo', 'Terceiro']);
  });

  it('faz lookup case-insensitive (citext)', async () => {
    const { username } = await createUserWithProfile();
    const data = await fetchPublicPage(anon!, username.toUpperCase());
    expect(data).not.toBeNull();
    expect(data!.profile.username).toBe(username);
  });

  it('username inexistente → null (caminho de 404)', async () => {
    const data = await fetchPublicPage(anon!, 'nao_existe_zzz_000');
    expect(data).toBeNull();
  });
});
