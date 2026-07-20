// TD-7 — o `?next=` do proxy edge passa a ser CONSUMIDO pelo login.
//
// O defeito: `proxy.ts` redirecionava para `/login?next=/dashboard/links`, mas nada
// jamais lia o parâmetro — depois de autenticar, o usuário caía sempre em
// `/dashboard` e perdia o destino original. Parâmetro morto.
//
// O QUE ESTE ARQUIVO PROVA:
//   1. Com `next` válido e interno, `signIn` redireciona PARA ELE.
//   2. Sem `next`, ou com `next` hostil, o fallback é `/dashboard` — ou seja, a
//      correção de UX NÃO abriu um open redirect.
//   3. A validação usada é a MESMA de `/auth/callback` (`safeNextPath`), então a
//      classe inteira de truques de normalização travada em
//      `auth-callback-next.test.ts` vale aqui também — por construção, não por
//      coincidência.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const ORIGIN = 'http://localhost:3000';

/** Destino capturado do `redirect()` — mockado porque não há request scope do Next. */
let redirectedTo: string | null;

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMIT_MESSAGE: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  checkRateLimit: async () => true,
}));

// Login sempre bem-sucedido: o que está sob teste é o DESTINO, não a autenticação.
vi.mock('@/lib/supabase', () => ({
  createServerClient: async () => ({
    auth: { signInWithPassword: async () => ({ error: null }) },
  }),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'origin' ? 'http://localhost:3000' : null),
  }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirectedTo = to;
    // O redirect real do Next interrompe a execução por throw; replicamos isso para
    // que o fluxo da action termine exatamente como em produção.
    throw new Error('NEXT_REDIRECT');
  },
}));

import { signIn } from '@/lib/actions/auth';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

/** Roda a action absorvendo o throw do redirect e devolve o destino capturado. */
async function loginWith(next?: string): Promise<string | null> {
  const entries: Record<string, string> = {
    email: 'alguem@example.com',
    password: 'senha-bem-longa',
  };
  if (next !== undefined) entries.next = next;

  await expect(signIn(null, fd(entries))).rejects.toThrow('NEXT_REDIRECT');
  return redirectedTo;
}

beforeEach(() => {
  redirectedTo = null;
});

describe('signIn — consumo do ?next= (TD-7)', () => {
  describe('honra destinos internos', () => {
    it('redireciona para o destino preservado pelo proxy', async () => {
      expect(await loginWith('/dashboard/links')).toBe('/dashboard/links');
    });

    it('preserva query string e hash do destino', async () => {
      expect(await loginWith('/dashboard/analytics?range=7d#topo')).toBe(
        '/dashboard/analytics?range=7d#topo'
      );
    });
  });

  describe('cai em /dashboard quando não há destino confiável', () => {
    it('sem `next` — comportamento histórico preservado', async () => {
      expect(await loginWith()).toBe('/dashboard');
    });

    it('`next` vazio', async () => {
      expect(await loginWith('')).toBe('/dashboard');
    });

    // Estes são os casos que transformariam a correção de UX numa vulnerabilidade.
    // O campo é INPUT DO USUÁRIO (hidden input), então um atacante controla o valor
    // via link: `/login?next=<destino hostil>`.
    it('recusa `//evil.com` (protocol-relative)', async () => {
      expect(await loginWith('//evil.com')).toBe('/dashboard');
    });

    it('recusa `/\\evil.com` (backslash normalizado pelo parser WHATWG)', async () => {
      expect(await loginWith('/\\evil.com')).toBe('/dashboard');
    });

    it('recusa URL absoluta externa', async () => {
      expect(await loginWith('https://evil.com/dashboard')).toBe('/dashboard');
    });

    it('recusa esquemas não-http (`javascript:`)', async () => {
      expect(await loginWith('javascript:alert(1)')).toBe('/dashboard');
    });

    it('recusa path relativo (sem `/` inicial)', async () => {
      expect(await loginWith('dashboard')).toBe('/dashboard');
    });
  });

  it('usa a mesma validação de /auth/callback (uma regra, não duas)', async () => {
    const { safeNextPath } = await import('@/lib/validation/next-path');
    const { safeNextPath: fromCallback } = await import('@/app/auth/callback/route');
    // Reexport, não cópia: divergir as duas seria o modo de falha mais provável aqui.
    expect(fromCallback).toBe(safeNextPath);
    expect(safeNextPath('/dashboard/links', ORIGIN)).toBe('/dashboard/links');
  });
});
