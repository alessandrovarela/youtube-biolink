// Story 5.1 / 6.3 — teste de integração: schema link_clicks + isolamento.
// Requer SERVICE_ROLE_KEY (criar usuários/profiles + cleanup sem rate-limit);
// sem o secret o bloco é skipado (mesmo padrão de links.test.ts / profile.test.ts).
//
// Story 6.3 mudou as premissas deste arquivo:
//   - `link_clicks` agora tem RLS habilitada e NENHUMA policy de INSERT/UPDATE/DELETE.
//     O INSERT anônimo direto (como este teste fazia) passa a ser NEGADO — é
//     exatamente o débito que a story fecha. A escrita legítima é a RPC
//     `record_link_click` (SECURITY DEFINER), coberta aqui e em link-clicks-rls.test.ts.
//   - A leitura deixou de ser autorizada só na application-layer: `link_clicks_select_own`
//     só cobre a role `authenticated`. O teste de isolamento entre perfis, que antes
//     usava client ANON com filtro app-layer, agora usa clients AUTENTICADOS — e por
//     isso virou um teste REAL de RLS (o que barra é a policy, não o `.eq()`).
import { describe, it, expect, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser, type TestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[link-clicks.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de integração de link_clicks skipado.'
  );
}

suite('Story 5.1 — schema link_clicks + isolamento (RLS, Story 6.3)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const anon = hasServiceRole() ? createAnonClient() : null;
  const createdUserIds: string[] = [];

  /** Cria um auth.user (com profile via trigger) e devolve id + credenciais. */
  async function createUserWithProfile(): Promise<{ id: string; user: TestUser }> {
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
    return { id: userId, user: u };
  }

  /** Client com anon key + JWT do usuário → role Postgres `authenticated`. */
  async function signIn(u: TestUser): Promise<SupabaseClient> {
    const client = createAnonClient();
    const { error } = await client.auth.signInWithPassword({
      email: u.email,
      password: u.password,
    });
    expect(error).toBeNull();
    return client;
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

  it('registro de clique via RPC funciona (append-only) e persiste UA truncado', async () => {
    const { id: profile } = await createUserWithProfile();
    const linkId = await createLink(profile, 'Meu canal');

    // A porta de escrita agora é a RPC — o INSERT direto está negado (ver abaixo).
    const { data: ok, error } = await anon!.rpc('record_link_click', {
      p_link_id: linkId,
      p_user_agent_short: 'Mozilla/5.0 (compatible)',
    });
    expect(error).toBeNull();
    expect(ok).toBe(true);

    // Releitura autoritativa com service role (bypassa RLS — não depende das policies).
    const { data: rows, error: readErr } = await admin!
      .from('link_clicks')
      .select('id, link_id, clicked_at, user_agent_short, user_agent_hash')
      .eq('link_id', linkId);

    expect(readErr).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].link_id).toBe(linkId);
    expect(rows![0].user_agent_short).toBe('Mozilla/5.0 (compatible)');
    expect(rows![0].user_agent_hash).toBeNull();
    expect(rows![0].clicked_at).toBeTruthy();
  });

  it('INSERT anônimo DIRETO em link_clicks é negado (RLS sem policy de INSERT)', async () => {
    const { id: profile } = await createUserWithProfile();
    const linkId = await createLink(profile, 'Canal');

    // Este era o concern MEDIUM do gate do Epic 5: a anon key é pública, então
    // qualquer um podia POSTar cliques falsos. Agora o banco recusa.
    const { error } = await anon!
      .from('link_clicks')
      .insert({ link_id: linkId, user_agent_short: 'forjado' });
    expect(error).not.toBeNull();

    const { data: rows } = await admin!.from('link_clicks').select('id').eq('link_id', linkId);
    expect(rows).toHaveLength(0);
  });

  it('CHECK do banco rejeita user_agent_short > 120 chars (defense in depth)', async () => {
    const { id: profile } = await createUserWithProfile();
    const linkId = await createLink(profile, 'Canal');

    // O CHECK continua sendo a última barreira: provado pelo caminho privilegiado
    // (service role), já que a RPC trunca com left(...,120) antes de inserir.
    const { error } = await admin!
      .from('link_clicks')
      .insert({ link_id: linkId, user_agent_short: 'x'.repeat(121) });
    expect(error).not.toBeNull();

    // E a RPC nunca deixa o CHECK estourar — trunca em 120.
    const { data: ok } = await anon!.rpc('record_link_click', {
      p_link_id: linkId,
      p_user_agent_short: 'y'.repeat(200),
    });
    expect(ok).toBe(true);

    const { data: rows } = await admin!
      .from('link_clicks')
      .select('user_agent_short')
      .eq('link_id', linkId);
    expect(rows).toHaveLength(1);
    expect((rows![0].user_agent_short as string).length).toBe(120);
  });

  it('usuário A não enxerga cliques de links de B (RLS: link_clicks_select_own)', async () => {
    const { id: profileA, user: userA } = await createUserWithProfile();
    const { id: profileB, user: userB } = await createUserWithProfile();
    const linkA = await createLink(profileA, 'Link do A');
    const linkB = await createLink(profileB, 'Link do B');

    // Cada link recebe um clique (seed com service role — não depende das policies).
    const { error: insErr } = await admin!
      .from('link_clicks')
      .insert([
        { link_id: linkA, user_agent_short: 'UA-A' },
        { link_id: linkB, user_agent_short: 'UA-B' },
      ]);
    expect(insErr).toBeNull();

    const asA = await signIn(userA);
    const asB = await signIn(userB);

    // SEM filtro app-layer nenhum: pedimos TODOS os cliques. O que restringe é a
    // policy — se ela falhar, o clique de B aparece aqui e o teste quebra.
    const { data: rowsA, error: readErr } = await asA
      .from('link_clicks')
      .select('id, link_id');

    expect(readErr).toBeNull();
    expect(rowsA!.every((r) => r.link_id === linkA)).toBe(true);
    expect(rowsA!.some((r) => r.link_id === linkB)).toBe(false);
    expect(rowsA!).toHaveLength(1);

    // Simetria: a visão de B contém apenas o clique de linkB.
    const { data: rowsB } = await asB.from('link_clicks').select('id, link_id');
    expect(rowsB!.every((r) => r.link_id === linkB)).toBe(true);
    expect(rowsB!).toHaveLength(1);

    // E o anônimo não vê nenhum dos dois (não há policy TO anon).
    const { data: rowsAnon, error: anonErr } = await anon!
      .from('link_clicks')
      .select('id, link_id')
      .in('link_id', [linkA, linkB]);
    expect(anonErr).toBeNull();
    expect(rowsAnon).toHaveLength(0);
  });
});
