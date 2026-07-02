// Story 4.3 — integração: persistência do tema e CHECK do banco (defense in depth).
// Skipa automaticamente quando não há SERVICE_ROLE disponível (mesmo padrão de
// tests/integration/profile.test.ts). O CHECK de profiles.theme foi criado na
// baseline (migration 20260614220038_profiles.sql).
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

suite('Story 4.3 — theme', () => {
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

  it('default é light', async () => {
    const id = await makeUser();
    const { data } = await admin!.from('profiles').select('theme').eq('id', id).single();
    expect(data?.theme).toBe('light');
  });

  it('persiste temas válidos (dark, accent)', async () => {
    const id = await makeUser();
    for (const theme of ['dark', 'accent', 'light'] as const) {
      const { error } = await admin!.from('profiles').update({ theme }).eq('id', id);
      expect(error).toBeNull();
      const { data } = await admin!.from('profiles').select('theme').eq('id', id).single();
      expect(data?.theme).toBe(theme);
    }
  });

  it('CHECK do banco rejeita theme inválido (defense in depth)', async () => {
    const id = await makeUser();
    const { error } = await admin!.from('profiles').update({ theme: 'neon' }).eq('id', id);
    expect(error).not.toBeNull();
  });
});
