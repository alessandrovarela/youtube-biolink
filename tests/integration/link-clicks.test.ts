// Story 5.1 — teste de integração: schema link_clicks + isolamento app-layer.
// Requer SERVICE_ROLE_KEY (criar usuários/profiles + cleanup sem rate-limit);
// sem o secret o bloco é skipado (mesmo padrão de links.test.ts / profile.test.ts).
//
// Sem RLS no MVP (ER.md — Epic 5): a leitura de analytics é autorizada na
// application-layer, fazendo join link_clicks → links → profiles e filtrando
// pelo dono (auth.uid()). Estes testes provam, contra o banco de dev, que:
//   - INSERT de um clique funciona (append-only);
//   - o usuário A, aplicando o filtro app-layer (profile_id do dono no join),
//     não enxerga cliques de links do usuário B.
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[link-clicks.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de integração de link_clicks skipado.'
  );
}

suite('Story 5.1 — schema link_clicks + isolamento app-layer', () => {
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

  /** Cria um link para o profile e retorna seu id. */
  async function createLink(profileId: string, title: string): Promise<string> {
    const { data, error } = await admin!
      .from('links')
      .insert({ profile_id: profileId, title, url: 'https://example.com' })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  afterAll(async () => {
    if (admin && createdUserIds.length) {
      // ON DELETE CASCADE remove profiles, links e link_clicks dos usuários de teste.
      await deleteTestUsers(admin, createdUserIds);
    }
  });

  it('INSERT de clique funciona (append-only) e persiste UA truncado', async () => {
    const profile = await createUserWithProfile();
    const linkId = await createLink(profile, 'Meu canal');

    const { data: click, error } = await anon!
      .from('link_clicks')
      .insert({ link_id: linkId, user_agent_short: 'Mozilla/5.0 (compatible)' })
      .select('id, link_id, clicked_at, user_agent_short, user_agent_hash')
      .single();

    expect(error).toBeNull();
    expect(click!.link_id).toBe(linkId);
    expect(click!.user_agent_short).toBe('Mozilla/5.0 (compatible)');
    expect(click!.user_agent_hash).toBeNull();
    expect(click!.clicked_at).toBeTruthy();
  });

  it('CHECK do banco rejeita user_agent_short > 120 chars (defense in depth)', async () => {
    const profile = await createUserWithProfile();
    const linkId = await createLink(profile, 'Canal');

    const { error } = await anon!
      .from('link_clicks')
      .insert({ link_id: linkId, user_agent_short: 'x'.repeat(121) });

    expect(error).not.toBeNull();
  });

  it('usuário A não enxerga cliques de links de B (filtro app-layer via join links→profiles)', async () => {
    const profileA = await createUserWithProfile();
    const profileB = await createUserWithProfile();
    const linkA = await createLink(profileA, 'Link do A');
    const linkB = await createLink(profileB, 'Link do B');

    // Cada link recebe um clique.
    const { error: insErr } = await admin!
      .from('link_clicks')
      .insert([
        { link_id: linkA, user_agent_short: 'UA-A' },
        { link_id: linkB, user_agent_short: 'UA-B' },
      ]);
    expect(insErr).toBeNull();

    // Leitura de analytics do A: mesma forma da Server Action — join até profiles
    // e filtro pelo dono. Só cliques de links cujo profile_id == A retornam.
    const { data: rowsA, error: readErr } = await anon!
      .from('link_clicks')
      .select('id, link_id, links!inner(profile_id)')
      .eq('links.profile_id', profileA);

    expect(readErr).toBeNull();
    expect(rowsA!.every((r) => r.link_id === linkA)).toBe(true);
    // O clique do link de B não vaza para a visão do A.
    expect(rowsA!.some((r) => r.link_id === linkB)).toBe(false);
    expect(rowsA!).toHaveLength(1);

    // Simetria: a visão de B contém apenas o clique de linkB.
    const { data: rowsB } = await anon!
      .from('link_clicks')
      .select('id, link_id, links!inner(profile_id)')
      .eq('links.profile_id', profileB);
    expect(rowsB!.every((r) => r.link_id === linkB)).toBe(true);
    expect(rowsB!).toHaveLength(1);
  });
});
