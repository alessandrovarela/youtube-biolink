// Story 2.1 — teste de integração: trigger auth.users → profiles.
// Requer SERVICE_ROLE_KEY (criar usuário sem e-mail/rate-limit + cleanup).
// Sem o secret, o bloco é skipado (ver blocker documentado na story).
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[profiles.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de integração de auth skipado.'
  );
}

suite('Story 2.1 — trigger de sincronização auth.users → profiles', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (admin && createdUserIds.length) {
      await deleteTestUsers(admin, createdUserIds);
    }
  });

  it('cria profile automaticamente com o username do metadata', async () => {
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

    const { data: profile, error: pErr } = await admin!
      .from('profiles')
      .select('id, username, theme, created_at')
      .eq('id', userId)
      .single();

    expect(pErr).toBeNull();
    expect(profile).not.toBeNull();
    expect(profile!.username).toBe(u.username);
    expect(profile!.theme).toBe('light'); // default da migration
  });

  it('cascade: deletar o auth.user remove o profile', async () => {
    const u = uniqueTestUser();
    const { data } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    const userId = data.user!.id;

    await admin!.auth.admin.deleteUser(userId);

    const { data: profile } = await admin!
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    expect(profile).toBeNull();
  });
});
