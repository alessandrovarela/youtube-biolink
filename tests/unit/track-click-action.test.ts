// Story 5.2 — testes unitários da Server Action de tracking de clique.
// Mockam o client público do Supabase e headers() de next/headers. Verificam:
// validação de uuid, existência/atividade do link antes do insert, truncamento
// do user-agent (<=120) e tratamento gracioso de falha (nunca lança).
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────
let mockClient: MockClient;
let mockUserAgent: string | null;

vi.mock('@/lib/supabase', () => ({
  // Client público é síncrono (stateless anon), diferente de createServerClient.
  createPublicClient: () => mockClient,
}));
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === 'user-agent' ? mockUserAgent : null),
  }),
}));

import { trackLinkClick } from '@/lib/actions/track-click';

// ── Infra de mock do query builder ────────────────────────────────────
type QueryResult = { data?: unknown; error?: unknown };

/** Builder encadeável e "thenable"; registra cada chamada no log compartilhado. */
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
  eq(...a: unknown[]) {
    return this.rec('eq', a);
  }
  maybeSingle() {
    this.log.push(['maybeSingle', []]);
    return Promise.resolve(this.result);
  }
  then<R>(onF: (v: QueryResult) => R): Promise<R> {
    return Promise.resolve(this.result).then(onF);
  }
}

interface MockClient {
  from: (table: string) => QueryStub;
  log: Array<[string, unknown[]]>;
  tables: string[];
}

/** Cria um client mock: `results` são consumidos em ordem por chamada de from(). */
function makeClient(results: QueryResult[]): MockClient {
  const log: Array<[string, unknown[]]> = [];
  const tables: string[] = [];
  let i = 0;
  return {
    log,
    tables,
    from(table: string) {
      tables.push(table);
      return new QueryStub(results[i++] ?? {}, log);
    },
  };
}

/** Retorna o payload do primeiro insert registrado no log. */
function insertPayload(client: MockClient): Record<string, unknown> | undefined {
  const call = client.log.find(([name]) => name === 'insert');
  return call?.[1][0] as Record<string, unknown> | undefined;
}

const VALID_ID = 'a0000000-0000-4000-8000-000000000000';

beforeEach(() => {
  vi.clearAllMocks();
  mockUserAgent = 'Mozilla/5.0 (compatible)';
});

describe('trackLinkClick', () => {
  it('rejeita linkId que não é uuid válido (sem tocar o banco)', async () => {
    mockClient = makeClient([]);
    const res = await trackLinkClick('not-a-uuid');
    expect(res).toEqual({ ok: false, error: 'Link inválido' });
    expect(mockClient.tables).toEqual([]); // nenhuma query disparada
  });

  it('rejeita quando o link não existe', async () => {
    mockClient = makeClient([{ data: null }]); // select do link → nada
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: false, error: 'Link não encontrado' });
    expect(insertPayload(mockClient)).toBeUndefined(); // não inseriu clique
  });

  it('rejeita quando o link está inativo', async () => {
    mockClient = makeClient([{ data: { id: VALID_ID, is_active: false } }]);
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: false, error: 'Link inativo' });
    expect(insertPayload(mockClient)).toBeUndefined();
  });

  it('registra o clique de um link ativo (link_id + UA)', async () => {
    mockClient = makeClient([
      { data: { id: VALID_ID, is_active: true } }, // select do link
      {}, // insert ok
    ]);
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: true });
    expect(mockClient.tables).toEqual(['links', 'link_clicks']);
    expect(insertPayload(mockClient)).toEqual({
      link_id: VALID_ID,
      user_agent_short: 'Mozilla/5.0 (compatible)',
    });
  });

  it('trunca o user-agent para <=120 chars antes de gravar', async () => {
    mockUserAgent = 'x'.repeat(200);
    mockClient = makeClient([{ data: { id: VALID_ID, is_active: true } }, {}]);
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: true });
    const payload = insertPayload(mockClient);
    expect((payload?.user_agent_short as string).length).toBe(120);
  });

  it('grava user_agent_short null quando não há header user-agent', async () => {
    mockUserAgent = null;
    mockClient = makeClient([{ data: { id: VALID_ID, is_active: true } }, {}]);
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: true });
    expect(insertPayload(mockClient)).toMatchObject({ user_agent_short: null });
  });

  it('trata falha de insert graciosamente (nunca lança)', async () => {
    mockClient = makeClient([
      { data: { id: VALID_ID, is_active: true } },
      { error: { message: 'boom' } }, // insert falha
    ]);
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: false, error: 'Não foi possível registrar o clique.' });
  });
});
