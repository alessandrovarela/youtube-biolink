// Story 3.1 — teste de integração: schema links + isolamento app-layer.
// Requer SERVICE_ROLE_KEY (criar usuários/profiles + cleanup sem rate-limit).
// Sem o secret, o bloco é skipado (mesmo padrão de profiles.test.ts).
//
// Sem RLS no MVP (architecture.md § 9.3): a autorização é app-layer, feita
// filtrando as mutações por profile_id do dono. Estes testes verificam que
// esse filtro isola de fato usuários distintos, e que a query pública só
// expõe links ativos do profile correto, ordenados por position.
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[links.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de integração de links skipado.'
  );
}

suite('Story 3.1 — schema links + isolamento app-layer', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const anon = hasServiceRole() ? createAnonClient() : null;
  const createdUserIds: string[] = [];

  /** Cria um auth.user (com profile via trigger) e retorna o id (== profile_id). */
  async function createUserWithProfile(): Promise<string> {
    const u = uniqueTestUser();
    const { data, error } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    expect(error).toBeNull();
    const userId = data.user!.id;
    createdUserIds.push(userId);
    return userId;
  }

  afterAll(async () => {
    if (admin && createdUserIds.length) {
      // ON DELETE CASCADE remove profiles e links dos usuários de teste.
      await deleteTestUsers(admin, createdUserIds);
    }
  });

  it('usuário A não consegue UPDATE/DELETE link de B via filtro app-layer por profile_id', async () => {
    const profileA = await createUserWithProfile();
    const profileB = await createUserWithProfile();

    // B cria um link.
    const { data: linkB, error: insErr } = await admin!
      .from('links')
      .insert({ profile_id: profileB, title: 'Link do B', url: 'https://b.example.com' })
      .select('id, title, url')
      .single();
    expect(insErr).toBeNull();
    const linkBId = linkB!.id;

    // A tenta atualizar o link de B, mas a app filtra pelo profile_id de A (o dono).
    // Sem linhas correspondentes (profile_id = A não casa), nada é alterado.
    const { data: updated } = await anon!
      .from('links')
      .update({ title: 'HACKEADO' })
      .eq('id', linkBId)
      .eq('profile_id', profileA)
      .select('id');
    expect(updated ?? []).toHaveLength(0);

    // A tenta deletar o link de B com o mesmo filtro app-layer.
    const { data: deleted } = await anon!
      .from('links')
      .delete()
      .eq('id', linkBId)
      .eq('profile_id', profileA)
      .select('id');
    expect(deleted ?? []).toHaveLength(0);

    // O link de B permanece intacto.
    const { data: check } = await admin!
      .from('links')
      .select('id, title')
      .eq('id', linkBId)
      .single();
    expect(check!.title).toBe('Link do B');
  });

  it('query pública retorna só is_active=true do profile correto, ordenado por position', async () => {
    const profile = await createUserWithProfile();
    const other = await createUserWithProfile();

    await admin!.from('links').insert([
      { profile_id: profile, title: 'Terceiro', url: 'https://c.example.com', position: 2, is_active: true },
      { profile_id: profile, title: 'Primeiro', url: 'https://a.example.com', position: 0, is_active: true },
      { profile_id: profile, title: 'Inativo', url: 'https://x.example.com', position: 1, is_active: false },
      { profile_id: profile, title: 'Segundo', url: 'https://b.example.com', position: 1, is_active: true },
      // Link de outro profile — não deve vazar na query.
      { profile_id: other, title: 'De outro', url: 'https://z.example.com', position: 0, is_active: true },
    ]);

    const { data: links, error } = await anon!
      .from('links')
      .select('title, position, is_active, profile_id')
      .eq('profile_id', profile)
      .eq('is_active', true)
      .order('position', { ascending: true });

    expect(error).toBeNull();
    // Só os 3 links ativos do profile correto.
    expect(links!.every((l) => l.is_active === true)).toBe(true);
    expect(links!.every((l) => l.profile_id === profile)).toBe(true);
    expect(links!.map((l) => l.title)).toEqual(['Primeiro', 'Segundo', 'Terceiro']);
  });
});
