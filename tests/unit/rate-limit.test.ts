// Story 6.4 — testes unitários do helper de rate limiting (camada 2, app-layer).
//
// ESCOPO DESTE ARQUIVO: o que roda em TypeScript — derivação da identidade do chamador
// (IP efêmero → hash com pepper), o mapeamento dos targets do NFR18 e o fail-open.
//
// A JANELA DESLIZANTE NÃO É TESTADA AQUI, e isso é deliberado: ela vive inteiramente
// na função SQL `check_rate_limit`. Reimplementá-la em TS para testar seria um teste
// TAUTOLÓGICO — validaria a cópia, não o código que roda em produção. A janela é
// exercida contra o BANCO REAL em tests/integration/rate-limit.test.ts (virada de
// janela, limite exato e o caso "já estourou não incrementa"), que é uma prova
// estritamente mais forte. [Source: Story 6.4 AC15/AC16]
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';

// ── Mocks ──────────────────────────────────────────────────────────────
let mockHeaders: Record<string, string | null>;
let mockClient: MockClient;

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => mockHeaders[name.toLowerCase()] ?? null,
  }),
}));
vi.mock('@/lib/supabase', () => ({
  createPublicClient: () => mockClient,
}));

import {
  checkRateLimit,
  clientIp,
  subjectHash,
  pepper,
  TARGETS,
  RATE_LIMIT_MESSAGE,
} from '@/lib/rate-limit';

type RpcResult = { data?: unknown; error?: unknown };

interface MockClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  calls: Array<[string, Record<string, unknown>]>;
}

function makeClient(result: RpcResult): MockClient {
  const calls: Array<[string, Record<string, unknown>]> = [];
  return {
    calls,
    rpc(fn, args) {
      calls.push([fn, args]);
      return Promise.resolve(result);
    },
  };
}

/** Digest hex de 64 chars — o ÚNICO formato de identidade que pode chegar ao banco. */
const HEX64 = /^[0-9a-f]{64}$/;

beforeEach(() => {
  mockHeaders = { 'x-forwarded-for': '203.0.113.7' };
  mockClient = makeClient({ data: true });
  process.env.RATE_LIMIT_PEPPER = 'pepper-de-teste';
});

// ── clientIp: uso EFÊMERO, nunca persistido (NFR19) ─────────────────────
describe('clientIp', () => {
  it('extrai o PRIMEIRO elemento de x-forwarded-for (leftmost = cliente)', async () => {
    // A lista é "cliente, proxy1, proxy2": pegar outro elemento limitaria o proxy.
    mockHeaders = { 'x-forwarded-for': '198.51.100.42, 70.41.3.18, 150.172.238.178' };
    expect(await clientIp()).toBe('198.51.100.42');
  });

  it('tolera espaços em volta do elemento', async () => {
    mockHeaders = { 'x-forwarded-for': '  198.51.100.42 , 70.41.3.18' };
    expect(await clientIp()).toBe('198.51.100.42');
  });

  it('cai para x-real-ip quando não há x-forwarded-for', async () => {
    mockHeaders = { 'x-real-ip': '203.0.113.9' };
    expect(await clientIp()).toBe('203.0.113.9');
  });

  it('cai para x-real-ip quando x-forwarded-for está vazio', async () => {
    mockHeaders = { 'x-forwarded-for': '', 'x-real-ip': '203.0.113.9' };
    expect(await clientIp()).toBe('203.0.113.9');
  });

  it("cai para 'unknown' quando não há header nenhum (balde compartilhado)", async () => {
    mockHeaders = {};
    expect(await clientIp()).toBe('unknown');
  });
});

// ── subjectHash: privacidade por construção (NFR19) ─────────────────────
describe('subjectHash', () => {
  it('produz um digest hex de 64 chars', () => {
    expect(subjectHash('203.0.113.7')).toMatch(HEX64);
  });

  it('é determinístico para as mesmas partes e o mesmo pepper', () => {
    expect(subjectHash('203.0.113.7')).toBe(subjectHash('203.0.113.7'));
  });

  it('distingue IPs diferentes', () => {
    expect(subjectHash('203.0.113.7')).not.toBe(subjectHash('203.0.113.8'));
  });

  it('distingue (ip) de (ip, linkId) — o bucket track é por visitante E por link', () => {
    expect(subjectHash('203.0.113.7')).not.toBe(subjectHash('203.0.113.7', 'link-a'));
    expect(subjectHash('203.0.113.7', 'link-a')).not.toBe(subjectHash('203.0.113.7', 'link-b'));
  });

  it('muda inteiramente quando o pepper muda', () => {
    process.env.RATE_LIMIT_PEPPER = 'pepper-A';
    const a = subjectHash('203.0.113.7');
    process.env.RATE_LIMIT_PEPPER = 'pepper-B';
    expect(subjectHash('203.0.113.7')).not.toBe(a);
  });

  it('o IP em claro NÃO aparece no digest', () => {
    expect(subjectHash('203.0.113.7')).not.toContain('203.0.113.7');
  });
});

// ── RATE_LIMIT_PEPPER OBRIGATÓRIO (issue #2 do gate da Wave 3) ──────────
//
// O gate provou que a ausência do pepper não é degradação de privacidade e sim um vetor
// de LOCKOUT DE AUTENTICAÇÃO: com pepper vazio o subject é sha256(':'+ip), computável
// por qualquer um. Estes testes travam o comportamento novo — falhar ALTO em produção,
// fallback documentado fora dela.
describe('RATE_LIMIT_PEPPER — obrigatório em produção', () => {
  // `process.env.NODE_ENV` tem descritor não-configurável sob o Node do vitest; a única
  // via suportada de alterná-lo é o stubEnv, que também restaura sozinho.
  const setNodeEnv = (v: string) => vi.stubEnv('NODE_ENV', v);

  afterEach(() => vi.unstubAllEnvs());

  it('🔴 em produção SEM pepper: LANÇA — o app não sobe degradado', () => {
    delete process.env.RATE_LIMIT_PEPPER;
    setNodeEnv('production');
    expect(() => pepper()).toThrow(/RATE_LIMIT_PEPPER é OBRIGATÓRIO/);
  });

  it('🔴 a mensagem do erro explica o risco REAL (lockout), não só privacidade', () => {
    delete process.env.RATE_LIMIT_PEPPER;
    setNodeEnv('production');
    let msg = '';
    try {
      pepper();
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg.toLowerCase()).toContain('lockout');
    expect(msg).toContain('NUNCA NEXT_PUBLIC_');
  });

  it('em produção COM pepper: não lança e usa o valor do env', () => {
    process.env.RATE_LIMIT_PEPPER = 'pepper-de-producao';
    setNodeEnv('production');
    expect(pepper()).toBe('pepper-de-producao');
  });

  it('pepper só de espaços em branco conta como AUSENTE (não vira segredo vazio)', () => {
    process.env.RATE_LIMIT_PEPPER = '   ';
    setNodeEnv('production');
    expect(() => pepper()).toThrow(/RATE_LIMIT_PEPPER é OBRIGATÓRIO/);
  });

  it('fora de produção SEM pepper: usa fallback fixo e NÃO lança', () => {
    delete process.env.RATE_LIMIT_PEPPER;
    setNodeEnv('development');
    expect(() => pepper()).not.toThrow();
    expect(subjectHash('203.0.113.7')).toMatch(HEX64);
  });

  it('o fallback de development é DIFERENTE do pepper vazio que o gate explorou', () => {
    // Com pepper '' o subject era sha256(':'+ip) — o valor exato que o gate forjou.
    // O fallback não pode reproduzi-lo, senão a "correção" seria cosmética em dev.
    delete process.env.RATE_LIMIT_PEPPER;
    setNodeEnv('development');
    const forged = createHash('sha256').update(['', '203.0.113.77'].join(':')).digest('hex');
    expect(subjectHash('203.0.113.77')).not.toBe(forged);
  });
});

// ── checkRateLimit: targets do NFR18 e contrato ─────────────────────────
describe('checkRateLimit — targets do NFR18', () => {
  const cases: Array<['signup' | 'login' | 'reset' | 'track', number, number, number]> = [
    // bucket, limit, windowSeconds, bucketSeconds
    ['signup', 5, 3600, 60],
    ['login', 10, 900, 60],
    ['reset', 3, 3600, 60],
    ['track', 60, 60, 10],
  ];

  it.each(cases)(
    'TARGETS documenta bucket %s → limite %i em %is (sub-bucket %is)',
    (bucket, limit, windowSeconds, bucketSeconds) => {
      // Os valores NÃO trafegam mais na chamada (ver o teste abaixo): vivem hardcoded em
      // check_app_rate_limit. TARGETS é a cópia de referência do NFR18 e a trava contra
      // drift — tests/integration/rate-limit.test.ts confronta estes números com o
      // comportamento REAL da função SQL.
      expect(TARGETS[bucket]).toEqual({ limit, windowSeconds, bucketSeconds });
    }
  );

  it('🔴 chama check_app_rate_limit e envia SÓ bucket e subject — nunca limite/janela', async () => {
    // A trava de regressão da issue #1 do gate da Wave 3 no lado do app.
    // Se algum dia alguém voltar a chamar `check_rate_limit` com p_limit vindo daqui, o
    // limiter volta a ser uma primitiva de escrita remota — e este teste falha.
    await checkRateLimit('login');

    expect(mockClient.calls).toHaveLength(1);
    const [fn, args] = mockClient.calls[0];
    expect(fn).toBe('check_app_rate_limit');
    expect(Object.keys(args).sort()).toEqual(['p_bucket', 'p_subject']);
    expect(args.p_bucket).toBe('login');
    for (const forbidden of ['p_limit', 'p_window_seconds', 'p_bucket_seconds']) {
      expect(args).not.toHaveProperty(forbidden);
    }
  });

  it('cada bucket é enviado com o próprio nome (a allowlist do banco depende disso)', async () => {
    for (const bucket of ['signup', 'login', 'reset', 'track'] as const) {
      mockClient = makeClient({ data: true });
      await checkRateLimit(bucket, bucket === 'track' ? 'link-1' : undefined);
      expect(mockClient.calls[0][1].p_bucket).toBe(bucket);
    }
  });

  it('NUNCA envia IP raw ao banco — p_subject é sempre 64 hex', async () => {
    // A asserção central de NFR19 no lado do app.
    mockHeaders = { 'x-forwarded-for': '198.51.100.42' };
    await checkRateLimit('login');

    const subject = mockClient.calls[0][1].p_subject as string;
    expect(subject).toMatch(HEX64);
    expect(JSON.stringify(mockClient.calls[0][1])).not.toContain('198.51.100.42');
  });

  it('o bucket track chaveia por (ip, linkId), não só por ip', async () => {
    mockHeaders = { 'x-forwarded-for': '198.51.100.42' };
    await checkRateLimit('track', 'link-a');
    const withLink = mockClient.calls[0][1].p_subject;

    mockClient = makeClient({ data: true });
    await checkRateLimit('login');
    const withoutLink = mockClient.calls[0][1].p_subject;

    expect(withLink).not.toBe(withoutLink);
  });

  it('IPs diferentes caem em subjects diferentes (limite é POR IP)', async () => {
    mockHeaders = { 'x-forwarded-for': '198.51.100.1' };
    await checkRateLimit('login');
    const s1 = mockClient.calls[0][1].p_subject;

    mockClient = makeClient({ data: true });
    mockHeaders = { 'x-forwarded-for': '198.51.100.2' };
    await checkRateLimit('login');
    expect(mockClient.calls[0][1].p_subject).not.toBe(s1);
  });
});

describe('checkRateLimit — contrato de retorno', () => {
  it('true quando a função SQL permite', async () => {
    mockClient = makeClient({ data: true });
    expect(await checkRateLimit('login')).toBe(true);
  });

  it('false quando a função SQL diz que estourou', async () => {
    mockClient = makeClient({ data: false });
    expect(await checkRateLimit('login')).toBe(false);
  });

  // ── FAIL-OPEN (AC5/AC14) — um limiter quebrado nunca derruba o produto ──
  it('FAIL-OPEN: erro da RPC libera a requisição', async () => {
    mockClient = makeClient({ error: { message: 'permission denied' } });
    expect(await checkRateLimit('login')).toBe(true);
  });

  it('FAIL-OPEN: client explodindo libera a requisição e não lança', async () => {
    mockClient = {
      calls: [],
      rpc() {
        throw new Error('conexão caiu');
      },
    };
    await expect(checkRateLimit('login')).resolves.toBe(true);
  });

  it('FAIL-OPEN: retorno inesperado (null) é tratado como permitido', async () => {
    mockClient = makeClient({ data: null });
    expect(await checkRateLimit('login')).toBe(true);
  });
});

// ── Mensagem de estouro (AC12 / risco R2) ───────────────────────────────
describe('RATE_LIMIT_MESSAGE', () => {
  it('não revela o mecanismo do limiter', () => {
    const lowered = RATE_LIMIT_MESSAGE.toLowerCase();
    for (const leak of ['rate', 'limit', 'retry-after', 'bucket', 'ip', 'contador']) {
      expect(lowered).not.toContain(leak);
    }
  });

  it('não menciona conta/e-mail — a mesma mensagem serve exista ou não a conta', () => {
    const lowered = RATE_LIMIT_MESSAGE.toLowerCase();
    for (const leak of ['conta', 'e-mail', 'email', 'usuário', 'senha']) {
      expect(lowered).not.toContain(leak);
    }
  });
});
