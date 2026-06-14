/**
 * Validação de username — helper puro (sem acesso a DB).
 * Story 2.3 — Epic 2.
 *
 * A regex é idêntica à CHECK constraint `username_format` da migration de
 * `profiles` (Story 2.1): `^[a-z][a-z0-9_]*$`, 3-30 chars. Manter as duas em
 * paridade garante que app e banco nunca divirjam.
 */

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type UsernameError = 'too_short' | 'too_long' | 'invalid_format' | 'reserved';

/**
 * Nomes que não podem ser registrados como username — colidem com rotas
 * internas/estáticas. Comparados contra o valor já normalizado (lowercase).
 * Itens com `-`, `.` ou `_` inicial também são barrados pela regex de formato;
 * permanecem aqui como documentação explícita das rotas protegidas.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'auth',
  'dashboard',
  'help',
  'login',
  'logout',
  'settings',
  'signup',
  'reset-password',
  'health',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

const USERNAME_REGEX = /^[a-z][a-z0-9_]*$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 30;

/**
 * Valida um username aplicando, em ordem: comprimento, formato e lista de
 * reservados. O input é normalizado (`trim` + `toLowerCase`) antes de validar,
 * então `Alessandro` é aceito e tratado como `alessandro`.
 */
export function validateUsername(input: string): Result<void, UsernameError> {
  const username = input.trim().toLowerCase();

  if (username.length < MIN_LENGTH) return { ok: false, error: 'too_short' };
  if (username.length > MAX_LENGTH) return { ok: false, error: 'too_long' };
  if (!USERNAME_REGEX.test(username)) return { ok: false, error: 'invalid_format' };
  if (RESERVED_USERNAMES.has(username)) return { ok: false, error: 'reserved' };

  return { ok: true, value: undefined };
}

/** Normaliza um username para a forma canônica (lowercase, sem espaços). */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}
