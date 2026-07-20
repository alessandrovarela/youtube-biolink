// Validação de destino pós-redirect (`?next=`) — proteção contra open redirect.
//
// Extraído de `app/auth/callback/route.ts` (onde nasceu na Story 2.5 e foi endurecido
// no Epic 6) para ser compartilhado com o consumo de `?next=` no login (TD-7). A
// IMPLEMENTAÇÃO É A MESMA, sem uma vírgula alterada: o objetivo da extração é ter UMA
// função de validação para os dois consumidores, não duas parecidas. `route.ts` segue
// reexportando `safeNextPath`, então os testes existentes continuam válidos e o ponto
// de entrada histórico não quebra.

/**
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ POR QUE `startsWith('/') && !startsWith('//')` NÃO BASTA                       │
 * └──────────────────────────────────────────────────────────────────────────────┘
 * A validação original (Story 2.5) recusava `//evil.com`, mas deixava passar
 * `/\evil.com`: começa com '/' e não começa com '//', então passava nos dois testes.
 * O problema é que a comparação era feita sobre a STRING CRUA, enquanto quem decide o
 * destino é o PARSER de URL — e o parser do WHATWG trata `\` como `/` em URLs de
 * esquema especial (http/https). Resultado: `/\evil.com` vira `http://evil.com/`.
 *
 * A lição geral: nunca valide uma URL por inspeção de string quando o consumidor dela é
 * um parser. Valide DEPOIS de parsear, com o mesmo parser que o consumidor usa.
 *
 * Por isso resolvemos `next` contra o nosso próprio `origin` e comparamos o `.origin`
 * do resultado. Isso é imune à classe INTEIRA de truques de normalização (`//`, `/\`,
 * `/\/`, `\\`, encodings, URL absoluta), porque não tentamos adivinhar a normalização —
 * deixamos o parser normalizar e só então perguntamos "isto ainda aponta para nós?".
 *
 * Reconstruímos o retorno a partir de pathname+search+hash (e não devolvemos `next`
 * cru) para garantir que o valor usado no redirect é exatamente o que foi validado.
 * [Source: gate Wave 4 issue #6 · Epic 6 — Segurança & Hardening]
 */
export function safeNextPath(next: string | null, origin: string): string | null {
  if (!next) return null;
  // Barreira 1 (barata): só path absoluto local. Recusa `https://evil.com`,
  // `javascript:…`, `mailto:…` e qualquer coisa com esquema.
  if (!next.startsWith('/')) return null;

  // Barreira 2 (autoritativa): o parser decide, não a string.
  let resolved: URL;
  try {
    resolved = new URL(next, origin);
  } catch {
    return null;
  }
  if (resolved.origin !== origin) return null;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
