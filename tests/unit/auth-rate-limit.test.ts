// Story 6.4 — integração do rate limiting nas três Server Actions de auth.
//
// O QUE ESTE ARQUIVO PROVA (AC11/AC12 · riscos R1/R2):
//   1. Cada action consulta o bucket CERTO do NFR18 (signup / login / reset).
//   2. O limiter roda ANTES de qualquer trabalho caro — nem o client Supabase é
//      instanciado quando o bucket está estourado. É o ponto todo de um limiter.
//   3. A mensagem de estouro é GENÉRICA, IDÊNTICA nas três actions, e NÃO permite
//      enumerar contas: é a mesma exista ou não o e-mail informado.
//
// As actions usam createServerClient (cookies) e redirect() — ambos mockados, porque
// não há request scope do Next em teste.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────
let mockRateLimitAllows: boolean;
let rateLimitCalls: string[];
/** Quantas vezes o client Supabase foi instanciado — deve ser 0 no estouro. */
let supabaseClientCreated: number;

const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

// A string é repetida literalmente na factory porque vi.mock é hoisted para o topo do
// arquivo — nenhuma variável de escopo superior pode ser referenciada aqui.
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMIT_MESSAGE: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  checkRateLimit: async (bucket: string) => {
    rateLimitCalls.push(bucket);
    return mockRateLimitAllows;
  },
}));

vi.mock('@/lib/supabase', () => ({
  createServerClient: async () => {
    supabaseClientCreated++;
    // Se o limiter falhar em cortar cedo, o teste explode aqui em vez de passar batido.
    throw new Error('createServerClient não deveria ser chamado com o bucket estourado');
  },
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

import { signUp, signIn, requestPasswordReset } from '@/lib/actions/auth';

// ── Helpers ────────────────────────────────────────────────────────────
function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const VALID_SIGNUP = {
  email: 'alguem@example.com',
  password: 'senha-bem-longa',
  confirmPassword: 'senha-bem-longa',
  username: 'alguem',
};

beforeEach(() => {
  mockRateLimitAllows = false; // o cenário sob teste é o ESTOURO
  rateLimitCalls = [];
  supabaseClientCreated = 0;
});

describe('sanidade do mock', () => {
  it('a mensagem mockada é IDÊNTICA à exportada por lib/rate-limit (sem drift)', async () => {
    // Sem esta trava, mudar a mensagem real deixaria este arquivo verde testando uma
    // string que não existe mais em produção.
    const real = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit');
    expect(real.RATE_LIMIT_MESSAGE).toBe(RATE_LIMIT_MESSAGE);
  });
});

describe('rate limiting nas actions de auth — bucket correto (NFR18)', () => {
  it('signUp consulta o bucket `signup`', async () => {
    await signUp(null, fd(VALID_SIGNUP));
    expect(rateLimitCalls).toEqual(['signup']);
  });

  it('signIn consulta o bucket `login`', async () => {
    await signIn(null, fd({ email: 'a@example.com', password: 'x' }));
    expect(rateLimitCalls).toEqual(['login']);
  });

  it('requestPasswordReset consulta o bucket `reset`', async () => {
    await requestPasswordReset(null, fd({ email: 'a@example.com' }));
    expect(rateLimitCalls).toEqual(['reset']);
  });
});

describe('estouro → curto-circuito antes do trabalho caro (AC11)', () => {
  it('signUp não instancia o client Supabase quando estourado', async () => {
    await signUp(null, fd(VALID_SIGNUP));
    expect(supabaseClientCreated).toBe(0);
  });

  it('signIn não instancia o client Supabase quando estourado', async () => {
    await signIn(null, fd({ email: 'a@example.com', password: 'x' }));
    expect(supabaseClientCreated).toBe(0);
  });

  it('requestPasswordReset não instancia o client Supabase quando estourado', async () => {
    await requestPasswordReset(null, fd({ email: 'a@example.com' }));
    expect(supabaseClientCreated).toBe(0);
  });
});

describe('estouro → mensagem GENÉRICA (AC12 · risco R2)', () => {
  it('as três actions retornam exatamente a MESMA mensagem', async () => {
    const a = await signUp(null, fd(VALID_SIGNUP));
    const b = await signIn(null, fd({ email: 'a@example.com', password: 'x' }));
    const c = await requestPasswordReset(null, fd({ email: 'a@example.com' }));

    for (const res of [a, b, c]) {
      expect(res).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
    }
  });

  it('a mensagem é idêntica exista ou não a conta — não dá para enumerar', async () => {
    // O atacante não distingue "estourei numa conta real" de "numa inexistente".
    const existente = await signIn(null, fd({ email: 'real@example.com', password: 'x' }));
    const inexistente = await signIn(null, fd({ email: 'nao-existe@example.com', password: 'x' }));
    expect(existente).toEqual(inexistente);
  });

  it('o estouro NÃO devolve fieldErrors (não aponta para e-mail nem username)', async () => {
    const res = await signUp(null, fd(VALID_SIGNUP));
    expect(res && res.ok === false && res.fieldErrors).toBeUndefined();
  });

  it('o estouro vence a validação de campos (nem revela quais campos estão errados)', async () => {
    // Payload inválido de propósito: mesmo assim a resposta é a genérica de estouro.
    const res = await signUp(null, fd({ email: 'invalido', password: '1', confirmPassword: '2', username: '!!' }));
    expect(res).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
  });
});
