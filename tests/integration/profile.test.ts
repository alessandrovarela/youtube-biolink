// Story 2.10 — integração: atualização de perfil e constraints.
// A proteção cross-user é app-layer (filtro auth.uid() na action) — sem RLS no MVP,
// não há barreira no nível de query, então o teste real de isolamento vem no Epic 6
// (RLS). Aqui validamos: persistência do update e o CHECK de bio (defense in depth).
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

suite('Story 2.10 — perfil', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  async function makeUser() {
    const u = uniqueTestUser();
    const { data } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    createdUserIds.push(data.user!.id);
    return data.user!.id;
  }

  it('persiste display_name, bio e avatar_url', async () => {
    const id = await makeUser();
    const { error } = await admin!
      .from('profiles')
      .update({ display_name: 'Alessandro', bio: 'Olá!', avatar_url: 'https://e.com/a.png' })
      .eq('id', id);
    expect(error).toBeNull();

    const { data } = await admin!
      .from('profiles')
      .select('display_name, bio, avatar_url')
      .eq('id', id)
      .single();
    expect(data).toMatchObject({
      display_name: 'Alessandro',
      bio: 'Olá!',
      avatar_url: 'https://e.com/a.png',
    });
  });

  it('CHECK do banco rejeita bio > 160 (defense in depth)', async () => {
    const id = await makeUser();
    const { error } = await admin!
      .from('profiles')
      .update({ bio: 'x'.repeat(161) })
      .eq('id', id);
    expect(error).not.toBeNull();
  });
});
