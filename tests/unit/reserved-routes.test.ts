/**
 * Cobertura reserved-list ↔ rotas internas — Story 3.6.
 *
 * Prova que nenhum segmento de rota interno de `app/` pode ser registrado como
 * username: `validateUsername(segmento)` retorna sempre `{ ok: false, ... }`.
 * Este é o lado da garantia de não-conflito que depende de código do projeto.
 * A outra metade — precedência estática > dinâmica no App Router — é garantia do
 * framework Next.js e está documentada em `docs/architecture/routing.md § 2`.
 *
 * Nuance de ordenação: `validateUsername` checa comprimento → formato →
 * reserved-list. Segmentos com hífen (ex.: `reset-password`) são barrados ainda
 * mais cedo, pela regex de formato (`invalid_format`) — bloqueio mais forte, não
 * mais fraco. O que importa para a AC é que NENHUM segmento interno seja
 * registrável (`ok: false`).
 *
 * [Source: architecture.md § 2.5 — Reserved-list Routing; lib/validation/username.ts]
 */
import { describe, it, expect } from 'vitest';
import { validateUsername, RESERVED_USERNAMES } from '@/lib/validation/username';

/** Todos os segmentos de rota internos de topo existentes em `app/` (+ `api`). */
const INTERNAL_ROUTE_SEGMENTS = [
  'login',
  'signup',
  'dashboard',
  'auth',
  'reset-password',
  'health',
  'api',
] as const;

/**
 * Segmentos válidos no formato de username → bloqueados especificamente pela
 * reserved-list com `error: 'reserved'`.
 */
const FORMAT_VALID_SEGMENTS = ['login', 'signup', 'dashboard', 'auth', 'health', 'api'] as const;

describe('reserved routes ↔ registro de username (Story 3.6)', () => {
  it.each(INTERNAL_ROUTE_SEGMENTS)(
    'segmento interno "%s" não pode ser registrado como username',
    (segment) => {
      expect(validateUsername(segment).ok).toBe(false);
    },
  );

  it.each(FORMAT_VALID_SEGMENTS)(
    'segmento interno "%s" (válido no formato) é bloqueado como "reserved"',
    (segment) => {
      expect(validateUsername(segment)).toEqual({ ok: false, error: 'reserved' });
    },
  );

  it('"reset-password" é barrado ainda mais cedo, pela regex de formato', () => {
    // Contém hífen → `invalid_format` vence a reserved-list na ordem de checagem.
    // Bloqueio mais forte: continua impossível registrar como username.
    expect(validateUsername('reset-password')).toEqual({ ok: false, error: 'invalid_format' });
  });

  it('todos os segmentos internos constam de RESERVED_USERNAMES (documentação explícita)', () => {
    for (const segment of INTERNAL_ROUTE_SEGMENTS) {
      expect(RESERVED_USERNAMES.has(segment)).toBe(true);
    }
  });
});
