// Story 4.3 — testes unitários da Server Action updateTheme (Supabase mockado).
// Verificam: validação inline (theme ∈ {light,dark,accent}), auth, filtro authz
// por id = user.id e erro de persistência.
import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockClient: MockClient;

vi.mock('@/lib/supabase', () => ({
  createServerClient: async () => mockClient,
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { updateTheme } from '@/lib/actions/profile';

type QueryResult = { data?: unknown; error?: unknown };

/** Builder encadeável e "thenable" que registra as chamadas no log. */
class QueryStub {
  constructor(
    private result: QueryResult,
    private log: Array<[string, unknown[]]>
  ) {}
  private rec(name: string, args: unknown[]): this {
    this.log.push([name, args]);
    return this;
  }
  update(...a: unknown[]) {
    return this.rec('update', a);
  }
  eq(...a: unknown[]) {
    return this.rec('eq', a);
  }
  then<R>(onF: (v: QueryResult) => R): Promise<R> {
    return Promise.resolve(this.result).then(onF);
  }
}

interface MockClient {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  from: () => QueryStub;
  log: Array<[string, unknown[]]>;
}

function makeClient(userId: string | null, result: QueryResult = {}): MockClient {
  const log: Array<[string, unknown[]]> = [];
  return {
    log,
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
    from: () => new QueryStub(result, log),
  };
}

function eqCalls(client: MockClient): unknown[][] {
  return client.log.filter(([name]) => name === 'eq').map(([, args]) => args);
}

const USER = 'user-a-id';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateTheme', () => {
  it('rejeita tema inválido (validação inline)', async () => {
    mockClient = makeClient(USER);
    const res = await updateTheme('neon');
    expect(res).toEqual({ ok: false, error: 'Tema inválido' });
    // Não deve tocar no banco quando o input é inválido.
    expect(mockClient.log).toEqual([]);
  });

  it('rejeita string vazia', async () => {
    mockClient = makeClient(USER);
    const res = await updateTheme('');
    expect(res).toEqual({ ok: false, error: 'Tema inválido' });
  });

  it('rejeita quando não autenticado', async () => {
    mockClient = makeClient(null);
    const res = await updateTheme('dark');
    expect(res).toEqual({ ok: false, error: 'Faça login para continuar' });
  });

  it.each(['light', 'dark', 'accent'] as const)(
    'persiste "%s" filtrando por id = user.id',
    async (theme) => {
      mockClient = makeClient(USER, { error: null });
      const res = await updateTheme(theme);
      expect(res).toEqual({ ok: true });

      const updateCall = mockClient.log.find(([name]) => name === 'update');
      expect(updateCall?.[1][0]).toEqual({ theme });
      expect(eqCalls(mockClient)).toEqual([['id', USER]]);
    }
  );

  it('retorna erro amigável quando o update falha', async () => {
    mockClient = makeClient(USER, { error: { message: 'boom' } });
    const res = await updateTheme('dark');
    expect(res).toEqual({ ok: false, error: 'Não foi possível salvar o tema' });
  });
});
