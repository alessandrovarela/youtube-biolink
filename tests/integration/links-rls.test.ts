// Story 6.2 — integração: RLS de `public.links` validada NO BANCO.
//
// Diferença em relação a links.test.ts / links-crud.test.ts: aqueles validam a
// autorização application-layer (o filtro `.eq('profile_id', user.id)` que as Server
// Actions carregam). Aqui não passamos por Server Action nenhuma — falamos direto com o
// PostgREST usando a anon key (com e sem JWT), que é exatamente o que um atacante faria.
// O que barra é a policy, não o código da app.
//
// O ponto central da story são as DUAS policies PERMISSIVE de SELECT, que o Postgres
// combina por OR: `links_select_public_active` (is_active = true) e `links_select_own`
// (profile_id = auth.uid()). Sem a segunda, o dono perderia de vista os próprios links
// desativados — o toggle do dashboard viraria "o link sumiu".
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
    '[links-rls.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de RLS de links skipado.'
  );
}

suite('Story 6.2 — RLS em public.links (db-layer)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const createdUserIds: string[] = [];

  // Usuário A (o "atacante" autenticado / dono) e usuário B (a vítima).
  let userA: TestUser;
  let idA = '';
  let idB = '';

  /** Link ATIVO de A. */
  let activeA = '';
  /** Link INATIVO de A — o caso que só `links_select_own` torna visível. */
  let inactiveA = '';
  /** Link ATIVO de B. */
  let activeB = '';
  /** Link INATIVO de B — invisível para A (nem público, nem próprio). */
  let inactiveB = '';

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

  /** Semeia um link com service role (bypassa RLS — setup não depende das policies). */
  async function seedLink(
    profileId: string,
    title: string,
    isActive: boolean,
    position: number
  ): Promise<string> {
    const { data, error } = await admin!
      .from('links')
      .insert({
        profile_id: profileId,
        title,
        url: 'https://example.com/',
        position,
        is_active: isActive,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  beforeAll(async () => {
    userA = uniqueTestUser();
    const userB = uniqueTestUser();
    idA = await makeUser(userA);
    idB = await makeUser(userB);

    activeA = await seedLink(idA, 'Ativo do A', true, 0);
    inactiveA = await seedLink(idA, 'Inativo do A', false, 1);
    activeB = await seedLink(idB, 'Ativo do B', true, 0);
    inactiveB = await seedLink(idB, 'Inativo do B', false, 1);

    anon = createAnonClient();

    asA = createAnonClient();
    const { error } = await asA.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    expect(error).toBeNull();
  });

  afterAll(async () => {
    // ON DELETE CASCADE remove profiles e links dos usuários de teste.
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  // ── AC2 — leitura anônima: só links ativos ──────────────────────────────

  it('anon LÊ um link ativo (página pública ISR continua funcionando)', async () => {
    const { data, error } = await anon
      .from('links')
      .select('id, title')
      .eq('id', activeA)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.title).toBe('Ativo do A');
  });

  it('anon NÃO lê um link inativo, mesmo pedindo pelo id', async () => {
    const { data, error } = await anon
      .from('links')
      .select('id')
      .eq('id', inactiveA)
      .maybeSingle();

    // A policy não gera erro: a linha simplesmente não existe para esta role.
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('anon listando os links de um profile recebe só os ativos, sem filtro app-layer', async () => {
    // Reproduz o cenário em que a app "esqueceu" o .eq('is_active', true) —
    // exatamente o que a RLS existe para cobrir (NFR3, defense-in-depth).
    const { data, error } = await anon
      .from('links')
      .select('id, is_active')
      .eq('profile_id', idA);

    expect(error).toBeNull();
    expect(data!.map((r) => r.id)).toEqual([activeA]);
    expect(data!.every((r) => r.is_active === true)).toBe(true);
  });

  // ── AC2 — leitura do dono: inclui os próprios inativos ──────────────────

  it('o DONO lê os próprios links inativos (as duas policies SELECT combinam por OR)', async () => {
    // Query idêntica à de app/dashboard/links/page.tsx:18 — sem filtro de is_active.
    const { data, error } = await asA
      .from('links')
      .select('id, is_active')
      .eq('profile_id', idA)
      .order('position', { ascending: true });

    expect(error).toBeNull();
    expect(data!.map((r) => r.id)).toEqual([activeA, inactiveA]);
    expect(data!.map((r) => r.is_active)).toEqual([true, false]);
  });

  it('A (logado) vê o link ativo de B, mas não o inativo de B', async () => {
    const { data, error } = await asA.from('links').select('id').eq('profile_id', idB);

    expect(error).toBeNull();
    // links_select_public_active permite o ativo de terceiros (a página pública de B
    // precisa renderizar para um visitante logado); o inativo de B fica invisível.
    expect(data!.map((r) => r.id)).toEqual([activeB]);
    expect(data!.map((r) => r.id)).not.toContain(inactiveB);
  });

  // ── AC3 — INSERT ────────────────────────────────────────────────────────

  it('INSERT anônimo é negado (não há policy de INSERT para anon)', async () => {
    const { error } = await anon
      .from('links')
      .insert({ profile_id: idA, title: 'rls probe anon', url: 'https://example.com/' });

    expect(error).not.toBeNull();

    const { data: after } = await admin!
      .from('links')
      .select('id')
      .eq('title', 'rls probe anon');
    expect(after ?? []).toHaveLength(0);
  });

  it('A não insere link no perfil de B (WITH CHECK de links_insert_own)', async () => {
    const { error } = await asA
      .from('links')
      .insert({ profile_id: idB, title: 'rls probe cross', url: 'https://example.com/' });

    expect(error).not.toBeNull();

    const { data: after } = await admin!
      .from('links')
      .select('id')
      .eq('title', 'rls probe cross');
    expect(after ?? []).toHaveLength(0);
  });

  it('A insere link no PRÓPRIO perfil (a policy não é restritiva demais)', async () => {
    const { data, error } = await asA
      .from('links')
      .insert({ profile_id: idA, title: 'Novo do A', url: 'https://example.com/', position: 9 })
      .select('id, title')
      .single();

    expect(error).toBeNull();
    expect(data!.title).toBe('Novo do A');

    // Cleanup imediato para não interferir nas asserções de listagem acima.
    await admin!.from('links').delete().eq('id', data!.id);
  });

  // ── AC4 / AC5 — UPDATE e DELETE ─────────────────────────────────────────

  it('UPDATE anônimo é negado (não há policy de UPDATE para anon)', async () => {
    const { data, error } = await anon
      .from('links')
      .update({ title: 'HACKEADO' })
      .eq('id', activeA)
      .select('id');

    expect(error === null ? data : []).toEqual([]);

    const { data: after } = await admin!
      .from('links')
      .select('title')
      .eq('id', activeA)
      .single();
    expect(after!.title).toBe('Ativo do A');
  });

  it('DELETE anônimo é negado (não há policy de DELETE para anon)', async () => {
    const { data, error } = await anon.from('links').delete().eq('id', activeA).select('id');

    expect(error === null ? data : []).toEqual([]);

    const { data: still } = await admin!
      .from('links')
      .select('id')
      .eq('id', activeA)
      .maybeSingle();
    expect(still).not.toBeNull();
  });

  it('A não altera link de B, nem sem o filtro app-layer de ownership', async () => {
    // Sem .eq('profile_id', ...) — simula a Server Action que esqueceu o filtro.
    const { data, error } = await asA
      .from('links')
      .update({ title: 'HACKEADO' })
      .eq('id', activeB)
      .select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: after } = await admin!
      .from('links')
      .select('title')
      .eq('id', activeB)
      .single();
    expect(after!.title).toBe('Ativo do B');
  });

  it('A não deleta link de B', async () => {
    const { data, error } = await asA.from('links').delete().eq('id', activeB).select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: still } = await admin!
      .from('links')
      .select('id')
      .eq('id', activeB)
      .maybeSingle();
    expect(still).not.toBeNull();
  });

  it('UPDATE em massa por A atinge só os próprios links, nunca os de B', async () => {
    const { data, error } = await asA
      .from('links')
      .update({ url: 'https://rls-mass-update.example.com/' })
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    expect(error).toBeNull();
    // Inclui o inativo de A (links_select_own cobre o USING do UPDATE) e nada de B.
    expect((data ?? []).map((r) => r.id).sort()).toEqual([activeA, inactiveA].sort());

    const { data: bRows } = await admin!.from('links').select('url').eq('profile_id', idB);
    expect(bRows!.every((r) => r.url === 'https://example.com/')).toBe(true);
  });

  // ── AC4 — WITH CHECK: impede "doar" um link a outro perfil ──────────────

  it('WITH CHECK impede A mover um link próprio para o profile_id de B', async () => {
    const { error } = await asA
      .from('links')
      .update({ profile_id: idB })
      .eq('id', activeA)
      .select('id');

    // Aqui há erro de verdade (42501): a linha RESULTANTE viola o WITH CHECK.
    expect(error).not.toBeNull();

    const { data: after } = await admin!
      .from('links')
      .select('profile_id')
      .eq('id', activeA)
      .single();
    expect(after!.profile_id).toBe(idA);
  });

  // ── AC6 — RETURNING pós-mutação depende de uma policy de SELECT ─────────

  it('toggle para is_active = false retorna a linha (RETURNING coberto por links_select_own)', async () => {
    // Este é o caminho de lib/actions/links.ts:227 (toggleLinkActive): o UPDATE
    // desativa o link e faz .select('*'). Se `links_select_own` não existisse, o
    // RETURNING viria vazio (a linha já não satisfaz is_active = true) e a action
    // devolveria "Link não encontrado" para uma operação bem-sucedida.
    const { data, error } = await asA
      .from('links')
      .update({ is_active: false })
      .eq('id', activeA)
      .eq('profile_id', idA)
      .select('*')
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.is_active).toBe(false);

    // E o dono continua enxergando o link recém-desativado.
    const { data: seen } = await asA
      .from('links')
      .select('id')
      .eq('id', activeA)
      .maybeSingle();
    expect(seen!.id).toBe(activeA);

    // Restaura o estado para não afetar outros testes do arquivo.
    await admin!.from('links').update({ is_active: true }).eq('id', activeA);
  });

  it('DELETE do próprio link retorna a linha removida (RETURNING do deleteLink)', async () => {
    const disposable = await seedLink(idA, 'Descartável', true, 20);

    const { data, error } = await asA
      .from('links')
      .delete()
      .eq('id', disposable)
      .eq('profile_id', idA)
      .select('id')
      .maybeSingle();

    expect(error).toBeNull();
    expect(data!.id).toBe(disposable);

    const { data: gone } = await admin!
      .from('links')
      .select('id')
      .eq('id', disposable)
      .maybeSingle();
    expect(gone).toBeNull();
  });
});
