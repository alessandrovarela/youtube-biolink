// Story 6.1 — integração: RLS de `public.profiles` validada NO BANCO.
//
// Diferença em relação a profile.test.ts: aquele valida a autorização application-layer
// (o filtro `.eq('id', user.id)` da Server Action). Aqui não passamos por Server Action
// nenhuma — falamos direto com o PostgREST usando a anon key (com e sem JWT), que é
// exatamente o que um atacante faria. O que barra é a policy, não o código da app.
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
    '[profiles-rls.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de RLS de profiles skipado.'
  );
}

suite('Story 6.1 — RLS em public.profiles (db-layer)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const createdUserIds: string[] = [];

  // Usuário A (o "atacante" autenticado) e usuário B (a vítima).
  let userA: TestUser;
  let userB: TestUser;
  let idA = '';
  let idB = '';
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

  beforeAll(async () => {
    userA = uniqueTestUser();
    userB = uniqueTestUser();
    idA = await makeUser(userA);
    idB = await makeUser(userB);

    anon = createAnonClient();

    asA = createAnonClient();
    const { error } = await asA.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    expect(error).toBeNull();
  });

  afterAll(async () => {
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  // ── AC2 / AC6 — leitura anônima preservada ──────────────────────────────
  // O caminho mais frágil da story: se a policy de SELECT dependesse de auth.uid(),
  // isto retornaria null e o signup passaria a aceitar usernames duplicados.

  it('SELECT anônimo por username retorna a linha (checagem de duplicata do signup)', async () => {
    const { data, error } = await anon
      .from('profiles')
      .select('id')
      .eq('username', userB.username)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(idB);
  });

  it('SELECT anônimo lê as colunas públicas do perfil (página pública ISR)', async () => {
    const { data, error } = await anon
      .from('profiles')
      .select('username, display_name, bio, avatar_url, theme')
      .eq('username', userB.username)
      .single();

    expect(error).toBeNull();
    expect(data!.username).toBe(userB.username);
    expect(data!.theme).toBe('light');
  });

  it('SELECT anônimo de username inexistente retorna null (não é erro de policy)', async () => {
    const { data, error } = await anon
      .from('profiles')
      .select('id')
      .eq('username', 'nao_existe_zzz_999')
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  // ── AC3 — escrita cross-user barrada pelo banco ─────────────────────────

  it('UPDATE de A no profile de B não altera nenhuma linha', async () => {
    const { data, error } = await asA
      .from('profiles')
      .update({ display_name: 'HACKED' })
      .eq('id', idB)
      .select('id');

    // A policy não gera erro: o predicado do USING simplesmente não casa
    // com nenhuma linha, então o UPDATE afeta 0 linhas silenciosamente.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Releitura autoritativa com service role (bypassa RLS).
    const { data: after } = await admin!
      .from('profiles')
      .select('display_name')
      .eq('id', idB)
      .single();
    expect(after!.display_name).toBeNull();
  });

  it('UPDATE sem filtro de A atinge apenas o próprio profile, não o de B', async () => {
    // Simula a Server Action que "esqueceu" o .eq('id', user.id) — o cenário
    // exato que a RLS existe para cobrir (NFR3, defense-in-depth).
    const { data, error } = await asA
      .from('profiles')
      .update({ bio: 'update sem filtro' })
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    expect(error).toBeNull();
    expect(data!.map((r) => r.id)).toEqual([idA]);

    const { data: bAfter } = await admin!.from('profiles').select('bio').eq('id', idB).single();
    expect(bAfter!.bio).toBeNull();
  });

  it('UPDATE do próprio profile por A funciona (policy não é restritiva demais)', async () => {
    const { data, error } = await asA
      .from('profiles')
      .update({ display_name: 'Alessandro' })
      .eq('id', idA)
      .select('id, display_name');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].display_name).toBe('Alessandro');
  });

  it('WITH CHECK impede A reatribuir o próprio id para o id de B', async () => {
    const { error } = await asA.from('profiles').update({ id: idB }).eq('id', idA).select('id');

    // Aqui há erro de verdade: a linha resultante viola o WITH CHECK (42501)
    // — ou a PK/FK, conforme a ordem de avaliação. Qualquer um serve: não passa.
    expect(error).not.toBeNull();

    const { data: aAfter } = await admin!.from('profiles').select('id').eq('id', idA).maybeSingle();
    expect(aAfter).not.toBeNull();
  });

  it('UPDATE anônimo (sem sessão) é negado — a policy de UPDATE é só para authenticated', async () => {
    const { data, error } = await anon
      .from('profiles')
      .update({ display_name: 'ANON' })
      .eq('id', idB)
      .select('id');

    expect(error === null ? data : []).toEqual([]);

    const { data: after } = await admin!
      .from('profiles')
      .select('display_name')
      .eq('id', idB)
      .single();
    expect(after!.display_name).toBeNull();
  });

  // ── AC4 — ausência de policy = negação ──────────────────────────────────

  it('INSERT direto em profiles é negado (só o trigger handle_new_user insere)', async () => {
    const { error: anonErr } = await anon
      .from('profiles')
      .insert({ id: crypto.randomUUID(), username: 'rls_probe_anon' });
    expect(anonErr).not.toBeNull();

    const { error: authErr } = await asA
      .from('profiles')
      .insert({ id: crypto.randomUUID(), username: 'rls_probe_auth' });
    expect(authErr).not.toBeNull();
  });

  it('DELETE do próprio profile é negado (remoção só via cascade de auth.users)', async () => {
    const { data, error } = await asA.from('profiles').delete().eq('id', idA).select('id');

    expect(error === null ? data : []).toEqual([]);

    const { data: still } = await admin!.from('profiles').select('id').eq('id', idA).maybeSingle();
    expect(still).not.toBeNull();
  });

  // ── AC1 — o trigger de signup continua inserindo sob RLS ────────────────

  // Nota: a instância de development tem signups públicos desabilitados
  // (`signup_disabled`), então usamos admin.createUser — que dispara exatamente o mesmo
  // trigger `on_auth_user_created` → `handle_new_user()`, que é o que a RLS poderia
  // quebrar. Mesma convenção de auth-signup.test.ts.
  it('criação de usuário insere o profile via trigger mesmo com RLS ligada', async () => {
    const u = uniqueTestUser();
    const newId = await makeUser(u);

    const { data: profile } = await admin!
      .from('profiles')
      .select('id, username')
      .eq('id', newId)
      .single();
    expect(profile!.username).toBe(u.username);

    // E o profile recém-criado já é visível para um visitante anônimo — que é
    // o que faz a checagem de duplicata do signup funcionar.
    const { data: seen } = await anon
      .from('profiles')
      .select('id')
      .eq('username', u.username)
      .maybeSingle();
    expect(seen!.id).toBe(newId);
  });
});
