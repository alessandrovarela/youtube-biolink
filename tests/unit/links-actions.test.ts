// Story 3.3 — testes unitários das Server Actions de links (Supabase mockado).
// Verificam: validação de input (título 1–60, url via sanitizeLinkUrl), filtro
// authz por profile_id = user.id, limite de 30 (rejeita o 31º) e position no fim.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────
// mockClient é trocado por teste; createServerClient o devolve preguiçosamente.
let mockClient: MockClient;

vi.mock('@/lib/supabase', () => ({
  createServerClient: async () => mockClient,
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createLink, updateLink, deleteLink, toggleLinkActive } from '@/lib/actions/links';

// ── Infra de mock do query builder ────────────────────────────────────
type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

/** Builder encadeável e "thenable": registra cada chamada no log compartilhado. */
class QueryStub {
  constructor(
    private result: QueryResult,
    private log: Array<[string, unknown[]]>
  ) {}
  private rec(name: string, args: unknown[]): this {
    this.log.push([name, args]);
    return this;
  }
  select(...a: unknown[]) {
    return this.rec('select', a);
  }
  insert(...a: unknown[]) {
    return this.rec('insert', a);
  }
  update(...a: unknown[]) {
    return this.rec('update', a);
  }
  delete(...a: unknown[]) {
    return this.rec('delete', a);
  }
  eq(...a: unknown[]) {
    return this.rec('eq', a);
  }
  order(...a: unknown[]) {
    return this.rec('order', a);
  }
  limit(...a: unknown[]) {
    return this.rec('limit', a);
  }
  single() {
    this.log.push(['single', []]);
    return Promise.resolve(this.result);
  }
  maybeSingle() {
    this.log.push(['maybeSingle', []]);
    return Promise.resolve(this.result);
  }
  // Torna o builder aguardável direto (ex.: count query sem terminal single).
  then<R>(onF: (v: QueryResult) => R): Promise<R> {
    return Promise.resolve(this.result).then(onF);
  }
}

interface MockClient {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  from: () => QueryStub;
  log: Array<[string, unknown[]]>;
}

/** Cria um client mock: `results` são consumidos em ordem por chamada de from(). */
function makeClient(userId: string | null, results: QueryResult[]): MockClient {
  const log: Array<[string, unknown[]]> = [];
  let i = 0;
  return {
    log,
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
    from: () => new QueryStub(results[i++] ?? {}, log),
  };
}

/** Extrai os args das chamadas de eq registradas no log. */
function eqCalls(client: MockClient): unknown[][] {
  return client.log.filter(([name]) => name === 'eq').map(([, args]) => args);
}

const USER = 'user-a-id';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createLink ─────────────────────────────────────────────────────────
describe('createLink', () => {
  it('rejeita quando não autenticado', async () => {
    mockClient = makeClient(null, []);
    const res = await createLink({ title: 'T', url: 'https://x.com' });
    expect(res).toEqual({ ok: false, error: 'Faça login para continuar' });
  });

  it('rejeita título vazio com fieldError', async () => {
    mockClient = makeClient(USER, []);
    const res = await createLink({ title: '  ', url: 'https://x.com' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.title).toBeDefined();
  });

  it('rejeita título > 60 chars', async () => {
    mockClient = makeClient(USER, []);
    const res = await createLink({ title: 'x'.repeat(61), url: 'https://x.com' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.title).toBeDefined();
  });

  it('rejeita url inválida (javascript:) via sanitizeLinkUrl', async () => {
    mockClient = makeClient(USER, []);
    const res = await createLink({ title: 'Ok', url: 'javascript:alert(1)' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.url).toBeDefined();
  });

  it('bloqueia o 31º link (limite de 30)', async () => {
    mockClient = makeClient(USER, [{ count: 30 }]); // count query devolve 30
    const res = await createLink({ title: 'Ok', url: 'https://x.com' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/limite de 30/i);
  });

  it('cria com sucesso: filtra por profile_id, calcula position no fim e persiste url canônica', async () => {
    const created = {
      id: 'l1',
      profile_id: USER,
      title: 'Meu link',
      url: 'https://x.com/',
      position: 3,
      is_active: true,
      created_at: 'now',
      updated_at: null,
    };
    mockClient = makeClient(USER, [
      { count: 2 }, // count < 30
      { data: { position: 2 } }, // último position
      { data: created }, // insert
    ]);
    const res = await createLink({ title: 'Meu link', url: 'https://x.com' });
    expect(res).toEqual({ ok: true, data: created });
    // Toda query filtra pelo profile_id do usuário autenticado.
    expect(eqCalls(mockClient)).toEqual(
      expect.arrayContaining([['profile_id', USER]])
    );
    // O insert recebeu position = ultimo(2) + 1 = 3 e a url canônica (com barra).
    const insertCall = mockClient.log.find(([name]) => name === 'insert');
    expect(insertCall?.[1][0]).toMatchObject({
      profile_id: USER,
      title: 'Meu link',
      url: 'https://x.com/',
      position: 3,
    });
  });

  it('primeiro link do usuário recebe position 0', async () => {
    mockClient = makeClient(USER, [
      { count: 0 },
      { data: null }, // sem links → maybeSingle null
      { data: { id: 'l1', position: 0 } },
    ]);
    await createLink({ title: 'Primeiro', url: 'https://x.com' });
    const insertCall = mockClient.log.find(([name]) => name === 'insert');
    expect(insertCall?.[1][0]).toMatchObject({ position: 0 });
  });
});

// ── updateLink ─────────────────────────────────────────────────────────
describe('updateLink', () => {
  it('rejeita quando não autenticado', async () => {
    mockClient = makeClient(null, []);
    const res = await updateLink({ id: 'l1', title: 'novo' });
    expect(res).toEqual({ ok: false, error: 'Faça login para continuar' });
  });

  it('rejeita url inválida', async () => {
    mockClient = makeClient(USER, []);
    const res = await updateLink({ id: 'l1', url: 'data:text/html,x' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.url).toBeDefined();
  });

  it('aplica filtro authz por profile_id e retorna o link atualizado', async () => {
    const updated = { id: 'l1', profile_id: USER, title: 'novo', url: 'https://x.com/' };
    mockClient = makeClient(USER, [{ data: updated }]);
    const res = await updateLink({ id: 'l1', title: 'novo' });
    expect(res).toEqual({ ok: true, data: updated });
    expect(eqCalls(mockClient)).toEqual(
      expect.arrayContaining([['id', 'l1'], ['profile_id', USER]])
    );
  });

  it('link de outro usuário: filtro não casa → "Link não encontrado"', async () => {
    mockClient = makeClient(USER, [{ data: null }]); // 0 linhas afetadas
    const res = await updateLink({ id: 'link-de-B', title: 'hack' });
    expect(res).toEqual({ ok: false, error: 'Link não encontrado' });
  });
});

// ── deleteLink ─────────────────────────────────────────────────────────
describe('deleteLink', () => {
  it('deleta filtrando por profile_id do dono', async () => {
    mockClient = makeClient(USER, [{ data: { id: 'l1' } }]);
    const res = await deleteLink({ id: 'l1' });
    expect(res).toEqual({ ok: true });
    expect(eqCalls(mockClient)).toEqual(
      expect.arrayContaining([['id', 'l1'], ['profile_id', USER]])
    );
  });

  it('link de outro usuário: nada deletado → "Link não encontrado"', async () => {
    mockClient = makeClient(USER, [{ data: null }]);
    const res = await deleteLink({ id: 'link-de-B' });
    expect(res).toEqual({ ok: false, error: 'Link não encontrado' });
  });
});

// ── toggleLinkActive ───────────────────────────────────────────────────
describe('toggleLinkActive', () => {
  it('atualiza is_active filtrando por profile_id', async () => {
    const updated = { id: 'l1', profile_id: USER, is_active: false };
    mockClient = makeClient(USER, [{ data: updated }]);
    const res = await toggleLinkActive({ id: 'l1', is_active: false });
    expect(res).toEqual({ ok: true, data: updated });
    const updateCall = mockClient.log.find(([name]) => name === 'update');
    expect(updateCall?.[1][0]).toMatchObject({ is_active: false });
    expect(eqCalls(mockClient)).toEqual(
      expect.arrayContaining([['id', 'l1'], ['profile_id', USER]])
    );
  });

  it('rejeita is_active não booleano', async () => {
    mockClient = makeClient(USER, []);
    // @ts-expect-error — teste de guarda de runtime
    const res = await toggleLinkActive({ id: 'l1', is_active: 'sim' });
    expect(res).toEqual({ ok: false, error: 'Estado inválido' });
  });
});
