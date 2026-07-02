// Story 5.2 — teste de integração da Server Action trackLinkClick contra o dev.
// Exercita o caminho real da action (createPublicClient → INSERT em link_clicks),
// mockando apenas next/headers (não há request scope em teste). Requer
// SERVICE_ROLE_KEY para setup/teardown (criar usuário/link, limpar) — sem o
// secret o bloco é skipado, mesmo padrão de link-clicks.test.ts.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { createAdminClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

// next/headers não tem contexto de request em teste — mock devolve um UA fixo.
// (cookies incluído porque lib/supabase o importa no topo, embora não seja usado
// por createPublicClient.)
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === 'user-agent' ? 'Vitest/1.0 (integration)' : null,
  }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

import { trackLinkClick } from '@/lib/actions/track-click';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[track-click.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de integração de trackLinkClick skipado.'
  );
}

suite('Story 5.2 — trackLinkClick (integração, dev)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
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

  async function createLink(profileId: string, isActive: boolean): Promise<string> {
    const { data, error } = await admin!
      .from('links')
      .insert({ profile_id: profileId, title: 'Canal', url: 'https://example.com', is_active: isActive })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  afterAll(async () => {
    // ON DELETE CASCADE remove profiles, links e link_clicks dos usuários de teste.
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  it('grava uma linha em link_clicks para um link ativo real', async () => {
    const profile = await createUserWithProfile();
    const linkId = await createLink(profile, true);

    const res = await trackLinkClick(linkId);
    expect(res).toEqual({ ok: true });

    const { data: rows, error } = await admin!
      .from('link_clicks')
      .select('link_id, user_agent_short')
      .eq('link_id', linkId);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].user_agent_short).toBe('Vitest/1.0 (integration)');
  });

  it('não grava clique para link inativo (retorno tipado de erro)', async () => {
    const profile = await createUserWithProfile();
    const linkId = await createLink(profile, false);

    const res = await trackLinkClick(linkId);
    expect(res.ok).toBe(false);

    const { data: rows } = await admin!
      .from('link_clicks')
      .select('id')
      .eq('link_id', linkId);
    expect(rows).toHaveLength(0);
  });
});
