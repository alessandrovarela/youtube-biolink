// Story 3.3 — integração: CRUD de links ponta a ponta + isolamento cross-user.
// Requer SERVICE_ROLE_KEY (criar usuários/profiles + cleanup sem rate-limit);
// sem o secret o bloco é skipado (mesmo padrão de links.test.ts / profile.test.ts).
//
// As Server Actions (lib/actions/links.ts) dependem de cookies/getUser, então
// aqui reproduzimos a MESMA forma de query que elas executam (insert com
// profile_id do dono; update/delete filtrando por id + profile_id) para provar,
// contra o banco de dev, que o CRUD funciona e que o filtro app-layer isola
// usuários distintos (sem RLS no MVP — architecture.md § 9.3).
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[links-crud.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de integração de CRUD de links skipado.'
  );
}

suite('Story 3.3 — CRUD de links (integração)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const anon = hasServiceRole() ? createAnonClient() : null;
  const createdUserIds: string[] = [];

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
      await deleteTestUsers(admin, createdUserIds);
    }
  });

  it('CRUD ponta a ponta: create → read → update → toggle → delete', async () => {
    const profile = await createUserWithProfile();

    // CREATE (forma do createLink: insert com profile_id do dono, position no fim).
    const { data: created, error: createErr } = await admin!
      .from('links')
      .insert({ profile_id: profile, title: 'Meu canal', url: 'https://youtube.com/', position: 0 })
      .select('*')
      .single();
    expect(createErr).toBeNull();
    expect(created).toMatchObject({ title: 'Meu canal', url: 'https://youtube.com/', is_active: true });
    const id = created!.id;

    // READ (forma da page: filtro por profile_id, ordenado por position).
    const { data: list } = await admin!
      .from('links')
      .select('*')
      .eq('profile_id', profile)
      .order('position', { ascending: true });
    expect(list).toHaveLength(1);
    expect(list![0].id).toBe(id);

    // UPDATE (forma do updateLink: filtro id + profile_id).
    const { data: updated } = await admin!
      .from('links')
      .update({ title: 'Canal atualizado' })
      .eq('id', id)
      .eq('profile_id', profile)
      .select('*')
      .maybeSingle();
    expect(updated!.title).toBe('Canal atualizado');

    // TOGGLE (forma do toggleLinkActive).
    const { data: toggled } = await admin!
      .from('links')
      .update({ is_active: false })
      .eq('id', id)
      .eq('profile_id', profile)
      .select('is_active')
      .maybeSingle();
    expect(toggled!.is_active).toBe(false);

    // DELETE (forma do deleteLink: filtro id + profile_id).
    const { data: deleted } = await admin!
      .from('links')
      .delete()
      .eq('id', id)
      .eq('profile_id', profile)
      .select('id')
      .maybeSingle();
    expect(deleted!.id).toBe(id);

    const { data: after } = await admin!.from('links').select('id').eq('profile_id', profile);
    expect(after ?? []).toHaveLength(0);
  });

  it('position do novo link vai para o fim da lista', async () => {
    const profile = await createUserWithProfile();
    await admin!.from('links').insert([
      { profile_id: profile, title: 'A', url: 'https://a.com', position: 0 },
      { profile_id: profile, title: 'B', url: 'https://b.com', position: 1 },
    ]);

    // Reproduz o cálculo do createLink: maior position + 1.
    const { data: last } = await admin!
      .from('links')
      .select('position')
      .eq('profile_id', profile)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = last ? (last.position as number) + 1 : 0;
    expect(nextPosition).toBe(2);

    const { data: created } = await admin!
      .from('links')
      .insert({ profile_id: profile, title: 'C', url: 'https://c.com', position: nextPosition })
      .select('position')
      .single();
    expect(created!.position).toBe(2);
  });

  it('usuário A não altera nem deleta link de B (filtro app-layer por profile_id)', async () => {
    const profileA = await createUserWithProfile();
    const profileB = await createUserWithProfile();

    const { data: linkB } = await admin!
      .from('links')
      .insert({ profile_id: profileB, title: 'Link do B', url: 'https://b.example.com' })
      .select('id')
      .single();
    const linkBId = linkB!.id;

    // A tenta UPDATE com o filtro app-layer (profile_id de A): nada casa.
    const { data: updated } = await anon!
      .from('links')
      .update({ title: 'HACKEADO' })
      .eq('id', linkBId)
      .eq('profile_id', profileA)
      .select('id');
    expect(updated ?? []).toHaveLength(0);

    // A tenta DELETE com o mesmo filtro: nada casa.
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
      .select('title')
      .eq('id', linkBId)
      .single();
    expect(check!.title).toBe('Link do B');
  });
});
