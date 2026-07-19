// Story 6.3 — integração: RLS de `public.link_clicks`, hardening da view
// `link_click_daily` e contrato da RPC `record_link_click`, validados NO BANCO.
//
// Este arquivo é o TESTE-CHAVE da story. Ele não passa por Server Action nenhuma:
// fala direto com o PostgREST usando a anon key (com e sem JWT), que é exatamente o
// que um atacante de posse da anon key pública faria. O que barra é a policy / o
// grant / a função — não o código da app.
//
// Fecha DOIS furos:
//   1. concern MEDIUM do gate do Epic 5 — INSERT anônimo em link_clicks via PostgREST;
//   2. concern #1 do gate da Wave 1 do Epic 6 — a view link_click_daily executava com
//      os privilégios do owner (postgres, BYPASSRLS) e tinha grants para anon, o que
//      vazava a agregação de cliques de TODOS os perfis para qualquer visitante.
//
// Requer SUPABASE_SERVICE_ROLE_KEY (setup/teardown + releitura autoritativa — o service
// role bypassa RLS, então a verificação do estado final não depende das policies).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser, type TestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[link-clicks-rls.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de RLS de link_clicks skipado.'
  );
}

/** UUID sintaticamente válido que não existe em `links`. */
const GHOST_LINK = 'a0000000-0000-4000-8000-0000000000ff';

suite('Story 6.3 — RLS em public.link_clicks + view link_click_daily (db-layer)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const createdUserIds: string[] = [];

  let userA: TestUser;
  let idA = '';
  let idB = '';

  /** Link ATIVO de A — alvo legítimo do tracking. */
  let activeA = '';
  /** Link INATIVO de A — a RPC deve recusá-lo. */
  let inactiveA = '';
  /** Link ATIVO de B — os cliques dele nunca podem aparecer para A. */
  let activeB = '';

  /** Client com anon key + JWT de A → role Postgres `authenticated`. */
  let asA: SupabaseClient;
  /** Client com anon key sem sessão → role Postgres `anon`. */
  let anon: SupabaseClient;

  async function makeUser(u: TestUser): Promise<string> {
    const { data, error } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    createdUserIds.push(id);
    return id;
  }

  async function seedLink(profileId: string, title: string, isActive: boolean, position: number) {
    const { data, error } = await admin!
      .from('links')
      .insert({ profile_id: profileId, title, url: 'https://example.com/', position, is_active: isActive })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  /** Contagem autoritativa de cliques de um link (service role, bypassa RLS). */
  async function countClicks(linkId: string): Promise<number> {
    const { data, error } = await admin!.from('link_clicks').select('id').eq('link_id', linkId);
    expect(error).toBeNull();
    return data!.length;
  }

  beforeAll(async () => {
    userA = uniqueTestUser();
    const userB = uniqueTestUser();
    idA = await makeUser(userA);
    idB = await makeUser(userB);

    activeA = await seedLink(idA, 'Ativo do A', true, 0);
    inactiveA = await seedLink(idA, 'Inativo do A', false, 1);
    activeB = await seedLink(idB, 'Ativo do B', true, 0);

    // Cliques semeados com service role: o setup não pode depender das policies.
    const { error } = await admin!
      .from('link_clicks')
      .insert([
        { link_id: activeA, user_agent_short: 'seed-A' },
        { link_id: activeB, user_agent_short: 'seed-B' },
      ]);
    expect(error).toBeNull();

    anon = createAnonClient();
    asA = createAnonClient();
    const { error: signInErr } = await asA.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    expect(signInErr).toBeNull();
  });

  afterAll(async () => {
    // ON DELETE CASCADE remove profiles, links e link_clicks dos usuários de teste —
    // prova, de quebra, que a RLS não interfere na integridade referencial.
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  // ── AC3 — escrita direta negada (fecha o concern MEDIUM do Epic 5) ──────

  it('INSERT anônimo em link_clicks é NEGADO (não há policy de INSERT)', async () => {
    const before = await countClicks(activeA);

    const { error } = await anon
      .from('link_clicks')
      .insert({ link_id: activeA, user_agent_short: 'clique-forjado' });

    expect(error).not.toBeNull();
    expect(await countClicks(activeA)).toBe(before);
  });

  it('INSERT AUTENTICADO em link_clicks também é negado (nem o dono escreve direto)', async () => {
    const before = await countClicks(activeA);

    const { error } = await asA
      .from('link_clicks')
      .insert({ link_id: activeA, user_agent_short: 'dono-inflando' });

    expect(error).not.toBeNull();
    expect(await countClicks(activeA)).toBe(before);
  });

  it('UPDATE e DELETE anônimos em link_clicks não alteram nada (append-only real)', async () => {
    const before = await countClicks(activeA);

    const { data: upd } = await anon
      .from('link_clicks')
      .update({ user_agent_short: 'reescrito' })
      .eq('link_id', activeA)
      .select('id');
    expect(upd ?? []).toHaveLength(0);

    const { data: del } = await anon
      .from('link_clicks')
      .delete()
      .eq('link_id', activeA)
      .select('id');
    expect(del ?? []).toHaveLength(0);

    // Estado inalterado e conteúdo original intacto.
    expect(await countClicks(activeA)).toBe(before);
    const { data: rows } = await admin!
      .from('link_clicks')
      .select('user_agent_short')
      .eq('link_id', activeA);
    expect(rows!.every((r) => r.user_agent_short !== 'reescrito')).toBe(true);
  });

  // ── AC4 / AC2 — leitura ─────────────────────────────────────────────────

  it('SELECT anônimo em link_clicks é NEGADO por PRIVILÉGIO (duas camadas)', async () => {
    // Story 6.3: a RLS já negava — mas silenciosamente, devolvendo 200 com [], porque
    // `anon` mantinha o GRANT SELECT herdado do default do Supabase. Era o concern #2
    // do gate da Wave 2: a ESCRITA tinha duas camadas (RLS + ausência de grant) e a
    // LEITURA tinha só uma.
    // Story 6.4 revogou o grant, então agora a barreira externa é o PRIVILÉGIO e o erro
    // é 42501 — a RLS continua atrás como segunda camada.
    const { data, error } = await anon.from('link_clicks').select('id, link_id');

    expect(error).not.toBeNull();
    expect(String(error!.message).toLowerCase()).toContain('permission denied');
    expect(data).toBeNull();
  });

  it('o DONO lê os cliques dos próprios links e NÃO os de terceiros', async () => {
    // Sem filtro app-layer nenhum: se a policy falhar, o clique de B aparece aqui.
    const { data, error } = await asA.from('link_clicks').select('id, link_id');

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.link_id === activeA)).toBe(true);
    expect(data!.some((r) => r.link_id === activeB)).toBe(false);
  });

  // ── AC5/AC6/AC7 — hardening da view link_click_daily ────────────────────

  it('🔴 SELECT anônimo na view link_click_daily é NEGADO (vazamento fechado)', async () => {
    // Antes desta story a mesma chamada devolvia 200 com a agregação de cliques de
    // TODOS os perfis: a view não declarava security_invoker e rodava como `postgres`
    // (BYPASSRLS), e `anon` tinha grant de SELECT.
    const { data, error } = await anon.from('link_click_daily').select('link_id, day, clicks');

    expect(error).not.toBeNull();
    expect(String(error!.message).toLowerCase()).toContain('permission denied');
    expect(data).toBeNull();
  });

  it('o DONO lê a view e enxerga só a agregação dos próprios links', async () => {
    // Precisa do GRANT SELECT na TABELA BASE (link_clicks): com security_invoker = on,
    // o privilégio da view não basta. Sem ele: "permission denied for table link_clicks".
    const { data, error } = await asA.from('link_click_daily').select('link_id, day, clicks');

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.link_id === activeA)).toBe(true);
    expect(data!.some((r) => r.link_id === activeB)).toBe(false);
  });

  // ── AC9/AC10 — contrato da RPC record_link_click ────────────────────────

  it('RPC com link ATIVO retorna true e grava exatamente uma linha', async () => {
    const before = await countClicks(activeA);

    const { data, error } = await anon.rpc('record_link_click', {
      p_link_id: activeA,
      p_user_agent_short: 'RPC/1.0 teste',
    });

    expect(error).toBeNull();
    expect(data).toBe(true);
    expect(await countClicks(activeA)).toBe(before + 1);
  });

  it('RPC com link INATIVO retorna false e não grava', async () => {
    const { data, error } = await anon.rpc('record_link_click', {
      p_link_id: inactiveA,
      p_user_agent_short: 'RPC/1.0 teste',
    });

    expect(error).toBeNull();
    expect(data).toBe(false);
    expect(await countClicks(inactiveA)).toBe(0);
  });

  it('RPC com link INEXISTENTE retorna false, sem lançar', async () => {
    const { data, error } = await anon.rpc('record_link_click', {
      p_link_id: GHOST_LINK,
      p_user_agent_short: 'RPC/1.0 teste',
    });

    expect(error).toBeNull();
    expect(data).toBe(false);
    expect(await countClicks(GHOST_LINK)).toBe(0);
  });

  it('RPC trunca o user-agent em 120 chars (paridade com o CHECK do banco)', async () => {
    const { data, error } = await anon.rpc('record_link_click', {
      p_link_id: activeA,
      p_user_agent_short: 'z'.repeat(500),
    });

    expect(error).toBeNull();
    expect(data).toBe(true);

    const { data: rows } = await admin!
      .from('link_clicks')
      .select('user_agent_short')
      .eq('link_id', activeA)
      .like('user_agent_short', 'z%');
    expect(rows).toHaveLength(1);
    expect((rows![0].user_agent_short as string).length).toBe(120);
  });

  it('RPC aceita user_agent_short null (visitante sem header user-agent)', async () => {
    const before = await countClicks(activeA);

    const { data, error } = await anon.rpc('record_link_click', {
      p_link_id: activeA,
      p_user_agent_short: null,
    });

    expect(error).toBeNull();
    expect(data).toBe(true);
    expect(await countClicks(activeA)).toBe(before + 1);
  });

  it('a RPC é a ÚNICA porta: o clique gravado por ela é legível pelo dono via RLS', async () => {
    // Fecha o ciclo — a escrita privilegiada continua sujeita à leitura restrita.
    const { data, error } = await asA
      .from('link_clicks')
      .select('id, link_id')
      .eq('link_id', activeA);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});
