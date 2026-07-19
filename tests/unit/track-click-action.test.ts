// Story 5.2 / 6.3 — testes unitários da Server Action de tracking de clique.
// Mockam o client público do Supabase e headers() de next/headers.
//
// Story 6.3 mudou o mecanismo: a action não faz mais SELECT em `links` + INSERT em
// `link_clicks` (dois round-trips, com janela TOCTOU e INSERT hoje negado pela RLS).
// Agora chama a RPC `record_link_click`, que valida `is_active` DENTRO do banco,
// atômico com o INSERT. Estes testes passam a mockar `.rpc()` e verificam:
// validação de uuid antes de qualquer ida ao banco, nome e payload da RPC,
// truncamento do user-agent (<=120), tradução do retorno booleano e tratamento
// gracioso de falha (nunca lança). [Source: ADR-001 § 2]
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Story 6.4 acrescentou a camada 2 do rate limiting ANTES da RPC. O helper é mockado
// aqui (ele tem suíte própria em tests/unit/rate-limit.test.ts) para que estes testes
// continuem focados no contrato da action — e para poder forçar o estouro.
//
// ── Mocks ──────────────────────────────────────────────────────────────
let mockClient: MockClient;
let mockUserAgent: string | null;
/** Resultado de checkRateLimit; false = bucket estourado. */
let mockRateLimitAllows: boolean;
/** Cada chamada a checkRateLimit registrada como [bucket, extraKey]. */
let rateLimitCalls: Array<[string, string | undefined]>;

vi.mock('@/lib/supabase', () => ({
  // Client público é síncrono (stateless anon), diferente de createServerClient.
  createPublicClient: () => mockClient,
}));
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === 'user-agent' ? mockUserAgent : null),
  }),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async (bucket: string, extraKey?: string) => {
    rateLimitCalls.push([bucket, extraKey]);
    return mockRateLimitAllows;
  },
}));

import { trackLinkClick } from '@/lib/actions/track-click';

// ── Infra de mock ──────────────────────────────────────────────────────
type RpcResult = { data?: unknown; error?: unknown };

interface MockClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  /** Cada chamada a .rpc() registrada como [nome, argumentos]. */
  calls: Array<[string, Record<string, unknown>]>;
  /** Registra qualquer uso de .from() — deve permanecer vazio (não há mais query direta). */
  tables: string[];
  from: (table: string) => never;
}

/** Client mock cujo `.rpc()` sempre resolve para `result`. */
function makeClient(result: RpcResult): MockClient {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const tables: string[] = [];
  return {
    calls,
    tables,
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push([fn, args]);
      return Promise.resolve(result);
    },
    from(table: string): never {
      tables.push(table);
      throw new Error(`track-click não deve mais consultar a tabela "${table}" diretamente`);
    },
  };
}

/** Argumentos da primeira chamada de RPC registrada. */
function rpcArgs(client: MockClient): Record<string, unknown> | undefined {
  return client.calls[0]?.[1];
}

const VALID_ID = 'a0000000-0000-4000-8000-000000000000';

beforeEach(() => {
  vi.clearAllMocks();
  mockUserAgent = 'Mozilla/5.0 (compatible)';
  mockRateLimitAllows = true;
  rateLimitCalls = [];
});

describe('trackLinkClick', () => {
  it('rejeita linkId que não é uuid válido (sem tocar o banco)', async () => {
    mockClient = makeClient({});
    const res = await trackLinkClick('not-a-uuid');
    expect(res).toEqual({ ok: false, error: 'Link inválido' });
    expect(mockClient.calls).toEqual([]); // nenhuma RPC disparada
  });

  it('registra o clique de um link ativo via RPC record_link_click', async () => {
    mockClient = makeClient({ data: true });
    const res = await trackLinkClick(VALID_ID);

    expect(res).toEqual({ ok: true });
    expect(mockClient.calls).toHaveLength(1);
    expect(mockClient.calls[0][0]).toBe('record_link_click');
    expect(rpcArgs(mockClient)).toEqual({
      p_link_id: VALID_ID,
      p_user_agent_short: 'Mozilla/5.0 (compatible)',
    });
    // Um único round-trip: nenhuma leitura direta de `links` sobrou na action.
    expect(mockClient.tables).toEqual([]);
  });

  it('RPC retorna false (link inexistente ou inativo) → erro tipado, sem lançar', async () => {
    // A validação de is_active migrou para o banco: os dois casos que antes eram
    // "Link não encontrado" e "Link inativo" colapsam num único retorno `false`.
    mockClient = makeClient({ data: false });
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: false, error: 'Link não encontrado ou inativo' });
  });

  it('trunca o user-agent para <=120 chars antes de enviar à RPC', async () => {
    mockUserAgent = 'x'.repeat(200);
    mockClient = makeClient({ data: true });
    const res = await trackLinkClick(VALID_ID);

    expect(res).toEqual({ ok: true });
    expect((rpcArgs(mockClient)?.p_user_agent_short as string).length).toBe(120);
  });

  it('envia user_agent_short null quando não há header user-agent', async () => {
    mockUserAgent = null;
    mockClient = makeClient({ data: true });
    const res = await trackLinkClick(VALID_ID);

    expect(res).toEqual({ ok: true });
    expect(rpcArgs(mockClient)).toMatchObject({ p_user_agent_short: null });
  });

  it('trata erro da RPC graciosamente (nunca lança)', async () => {
    mockClient = makeClient({ error: { message: 'boom' } });
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: false, error: 'Não foi possível registrar o clique.' });
  });

  it('não lança se o client explodir (guarda de último recurso)', async () => {
    mockClient = {
      calls: [],
      tables: [],
      rpc() {
        throw new Error('conexão caiu');
      },
      from(): never {
        throw new Error('não usado');
      },
    };
    const res = await trackLinkClick(VALID_ID);
    expect(res).toEqual({ ok: false, error: 'Não foi possível registrar o clique.' });
  });
});

// ── Story 6.4 — camada 2 do rate limiting (AC11/AC13) ──────────────────
describe('trackLinkClick — rate limiting (camada 2)', () => {
  it('consulta o bucket `track` chaveado pelo linkId', async () => {
    // O NFR18 contratou 60/min por (IP do visitante, linkId): sem o linkId como
    // extraKey, um visitante clicando em links DIFERENTES compartilharia um bucket só.
    mockClient = makeClient({ data: true });
    await trackLinkClick(VALID_ID);

    expect(rateLimitCalls).toEqual([['track', VALID_ID]]);
  });

  it('o rate limit é avaliado ANTES da RPC (não gasta round-trip quando estoura)', async () => {
    mockRateLimitAllows = false;
    mockClient = makeClient({ data: true });

    await trackLinkClick(VALID_ID);

    // Nenhuma RPC disparada: cortou cedo, que é o ponto de um limiter.
    expect(mockClient.calls).toEqual([]);
  });

  it('estouro é NO-OP SILENCIOSO: retorna erro tipado e NUNCA lança', async () => {
    // Contrato fire-and-forget das Stories 5.2/5.3 preservado — a navegação do
    // visitante não pode ser bloqueada por um clique não contabilizado.
    mockRateLimitAllows = false;
    mockClient = makeClient({ data: true });

    const res = await trackLinkClick(VALID_ID);

    expect(res.ok).toBe(false);
    // Erro genérico: nada que a UI possa renderizar revelando o mecanismo.
    expect(res).toEqual({ ok: false, error: 'Não foi possível registrar o clique.' });
  });

  it('estouro não impede o clique SEGUINTE quando o limite libera', async () => {
    mockRateLimitAllows = false;
    mockClient = makeClient({ data: true });
    expect((await trackLinkClick(VALID_ID)).ok).toBe(false);

    mockRateLimitAllows = true;
    mockClient = makeClient({ data: true });
    expect((await trackLinkClick(VALID_ID)).ok).toBe(true);
  });

  it('linkId inválido nem chega ao rate limiter (validação primeiro)', async () => {
    mockClient = makeClient({});
    await trackLinkClick('not-a-uuid');
    expect(rateLimitCalls).toEqual([]);
  });
});
