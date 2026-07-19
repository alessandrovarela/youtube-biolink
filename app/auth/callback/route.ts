// Story 2.5 — callback de confirmação de e-mail (code flow, architecture.md § 8.1).
// Story 6.5 / Epic 6 — endurecimento da validação de `next` (issue #6 do gate da Wave 4).
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // `next` permite rotear pós-troca do code (ex.: recovery → nova senha).
  const safeNext = safeNextPath(searchParams.get('next'), origin);

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext ?? '/login?confirmed=1'}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/confirm-failed`);
}
