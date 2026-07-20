// Story 6.5 — Testes do proxy edge (AC12) e do matcher (AC4).
// TD-6: o arquivo era `middleware.ts`/`middleware.test.ts`; o Next 16 renomeou a
// convencao para `proxy.ts`. Rename puro, mesma lógica testada.
//
// O matcher é o risco central desta story: um padrão permissivo captura a página
// pública ISR `/[username]` (segmento raiz dinâmico) e a torna dinâmica, ferindo
// NFR1 — silenciosamente, sem quebrar build nem typecheck. Por isso o matcher é
// testado como CONTRATO, e não só o guard.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

/**
 * Converte um padrão de matcher do Next (`/dashboard/:path*`) no regex
 * equivalente, para verificar quais paths o Next invocaria. Reimplementar o
 * matching é o preço de testar o matcher sem subir o servidor; a verificação
 * de runtime real (curl) está registrada no Debug Log da story.
 */
function matcherToRegExp(pattern: string): RegExp {
  const source = pattern
    .replace(/\/:[A-Za-z0-9_]+\*/g, '(?:/.*)?') // `/:path*` → zero ou mais segmentos
    .replace(/\/:[A-Za-z0-9_]+/g, '/[^/]+'); // `/:id` → exatamente um segmento
  return new RegExp(`^${source}$`);
}

async function isMatched(pathname: string): Promise<boolean> {
  const { config } = await import('@/proxy');
  return config.matcher.some((p) => matcherToRegExp(p).test(pathname));
}

function requestFor(pathname: string, cookies?: Record<string, string>): NextRequest {
  const req = new NextRequest(new URL(`http://localhost:3000${pathname}`));
  for (const [name, value] of Object.entries(cookies ?? {})) {
    req.cookies.set(name, value);
  }
  return req;
}

describe('proxy — auth guard edge (AC2)', () => {
  it('redireciona para /login quando não há usuário na sessão', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const { proxy } = await import('@/proxy');
    const response = await proxy(requestFor('/dashboard'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
  });

  it('preserva o destino em ?next= para o pós-login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const { proxy } = await import('@/proxy');
    const response = await proxy(requestFor('/dashboard/links'));

    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/dashboard/links');
  });

  it('deixa a request seguir quando há usuário válido', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'owner@example.com' } },
      error: null,
    });

    const { proxy } = await import('@/proxy');
    const response = await proxy(requestFor('/dashboard', { 'sb-access-token': 'valid' }));

    // NextResponse.next() → 200 sem redirect.
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('usa getUser() (revalida e renova), não getSession()', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });

    const { proxy } = await import('@/proxy');
    await proxy(requestFor('/dashboard'));

    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});

describe('proxy — matcher cirúrgico (AC4/AC5)', () => {
  it('intercepta /dashboard e toda a subárvore', async () => {
    expect(await isMatched('/dashboard')).toBe(true);
    expect(await isMatched('/dashboard/links')).toBe(true);
    expect(await isMatched('/dashboard/analytics')).toBe(true);
  });

  it('NÃO intercepta a página pública ISR /[username] (NFR1)', async () => {
    // O caso que mais dói: username de segmento único casa com qualquer matcher
    // permissivo e degradaria o cache ISR sem sinal de erro.
    expect(await isMatched('/alessandro')).toBe(false);
    expect(await isMatched('/qualquer-usuario')).toBe(false);
  });

  it('NÃO intercepta /_next/* nem assets estáticos (custo de edge)', async () => {
    expect(await isMatched('/_next/static/chunks/main.js')).toBe(false);
    expect(await isMatched('/_next/image')).toBe(false);
    expect(await isMatched('/favicon.ico')).toBe(false);
    expect(await isMatched('/og-placeholder.png')).toBe(false);
  });

  it('NÃO intercepta as rotas de auth, health e a landing', async () => {
    // Interceptar /auth/callback quebraria a troca de code por sessão.
    expect(await isMatched('/auth/callback')).toBe(false);
    expect(await isMatched('/login')).toBe(false);
    expect(await isMatched('/signup')).toBe(false);
    expect(await isMatched('/health')).toBe(false);
    expect(await isMatched('/')).toBe(false);
  });

  it('não usa matcher catch-all com negative lookahead', async () => {
    // Guarda de regressão: o padrão da doc do Next é justamente o que captura
    // `/[username]`. Se alguém colar aquele matcher aqui, este teste falha.
    const { config } = await import('@/proxy');
    for (const pattern of config.matcher) {
      expect(pattern).not.toContain('(?!');
      expect(pattern).toMatch(/^\/dashboard/);
    }
  });
});
