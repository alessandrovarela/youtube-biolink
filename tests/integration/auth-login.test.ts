// Story 2.6 — integração: login com credenciais.
// Testado no nível Supabase (anon client) — a action completa exige runtime Next (cookies).
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

suite('Story 2.6 — login com credenciais', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  it('login válido retorna sessão', async () => {
    const u = uniqueTestUser();
    const { data } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    createdUserIds.push(data.user!.id);

    const anon = createAnonClient();
    const { data: signed, error } = await anon.auth.signInWithPassword({
      email: u.email,
      password: u.password,
    });
    expect(error).toBeNull();
    expect(signed.session).not.toBeNull();
    expect(signed.user?.id).toBe(data.user!.id);
  });

  it('credenciais inválidas retornam erro', async () => {
    const anon = createAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({
      email: 'inexistente@youtube-biolink.test',
      password: 'senhaerrada123',
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });
});
