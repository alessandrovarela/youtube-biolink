/**
 * Sanitização de URL de link — helper puro (sem acesso a DB).
 * Story 3.2 — Epic 3.
 *
 * Defesa primária contra schemes perigosos (`javascript:`, `data:`, etc.):
 * só `http:` e `https:` passam. A CHECK `url ~ '^https?://'` do banco
 * (Story 3.1) é a última linha de defesa — manter as duas em paridade
 * garante que app e banco nunca divirjam. Consumido por `createLink`/
 * `updateLink` (Story 3.3).
 */

import type { Result } from './username';

export type UrlError = 'empty' | 'no_scheme' | 'unsupported_scheme' | 'malformed';

/**
 * Schemes aceitos. O parser de `URL` normaliza o protocolo para lowercase
 * com `:` final, então a comparação é naturalmente case-insensitive —
 * `HTTPS://` e `HtTpS://` viram `https:`.
 */
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * Detecta a presença de um scheme (RFC 3986): ALPHA seguido de
 * ALPHA/DIGIT/`+`/`-`/`.` e um `:`. Serve só para dar um erro tipado preciso
 * a entradas sem scheme (ex.: `example.com`) — que de outra forma cairiam no
 * genérico `malformed` do parser.
 */
const HAS_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Valida e sanitiza uma URL de link. Aplica, em ordem: input vazio, presença
 * de scheme, parse (malformada) e allowlist de scheme. O input é normalizado
 * com `trim` antes de tudo — isso neutraliza obfuscation por espaço/tab
 * inicial (` javascript:...`, `\tjavascript:...`). O parser preserva query
 * (`search`) e fragment (`hash`).
 *
 * Retorna a URL canônica serializada (`url.href`) em caso de sucesso.
 */
export function sanitizeLinkUrl(input: string): Result<string, UrlError> {
  const trimmed = input.trim();

  if (trimmed.length === 0) return { ok: false, error: 'empty' };
  if (!HAS_SCHEME_REGEX.test(trimmed)) return { ok: false, error: 'no_scheme' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // `new URL()` lança em URLs absolutas malformadas.
    return { ok: false, error: 'malformed' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, error: 'unsupported_scheme' };
  }

  return { ok: true, value: url.href };
}
