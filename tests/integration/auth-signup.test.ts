// Story 2.4 — integração: integridade de signup (username único garantido no banco).
// O teste da action completa exige runtime Next (cookies) → coberto por smoke manual.
// Aqui validamos a garantia de dados: dois users com o mesmo username são rejeitados.
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

suite('Story 2.4 — integridade de signup', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  it('cria auth.user + profile com username do metadata', async () => {
    const u = uniqueTestUser();
    const { data, error } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    expect(error).toBeNull();
    createdUserIds.push(data.user!.id);

    const { data: profile } = await admin!
      .from('profiles')
      .select('username')
      .eq('id', data.user!.id)
      .single();
    expect(profile!.username).toBe(u.username);
  });

  it('rejeita username duplicado (UNIQUE citext via trigger)', async () => {
    const a = uniqueTestUser();
    const { data: ua, error: ea } = await admin!.auth.admin.createUser({
      email: a.email,
      password: a.password,
      email_confirm: true,
      user_metadata: { username: a.username },
    });
    expect(ea).toBeNull();
    createdUserIds.push(ua.user!.id);

    const b = uniqueTestUser();
    // mesmo username, case diferente → citext trata como igual
    const { data: ub, error: eb } = await admin!.auth.admin.createUser({
      email: b.email,
      password: b.password,
      email_confirm: true,
      user_metadata: { username: a.username.toUpperCase() },
    });
    expect(eb).not.toBeNull(); // trigger falha no INSERT duplicado → createUser erra
    if (ub?.user) createdUserIds.push(ub.user.id);
  });
});
