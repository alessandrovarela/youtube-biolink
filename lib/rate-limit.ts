// Story 6.4 — Rate limiting application-layer (camada 2).
//
// Wrapper fino sobre a função SQL `check_rate_limit` (migration 20260719190000).
// Toda a lógica de janela deslizante vive NO BANCO — aqui só se resolve a identidade
// do chamador e se traduz o resultado. Isso é o que torna a decisão reversível: migrar
// para Upstash depois seria trocar a implementação DESTE arquivo, e só dele.
// [Source: docs/architecture/security-epic-6.md — ADR-001 § 3]
//
// ZERO DEPENDÊNCIA NOVA: `node:crypto` é built-in do Node e `next/headers` já é usado
// pelo projeto (lib/actions/auth.ts, lib/actions/track-click.ts).
//
// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ DUAS CAMADAS — esta NÃO é a que fecha o click inflation                       │
// └──────────────────────────────────────────────────────────────────────────────┘
// O gate da Wave 2 provou que limitar apenas aqui deixa a porta dos fundos aberta:
// `record_link_click` é `grant execute to anon` e chamável direto pelo PostgREST, sem
// passar pelo Next.js. O teto que alcança TODOS os chamadores está DENTRO da RPC
// (60/min por link). Esta camada existe porque é a única que enxerga o IP do
// VISITANTE — na RPC, o IP visível seria o de egresso da Vercel, que colapsaria todo
// o tráfego legítimo num bucket global. As duas se somam; nenhuma substitui a outra.
// [Source: ADR-001 § 6.2/§ 6.3 · docs/qa/gates/epic-6-wave-2-gate.yml concern #1]

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createPublicClient } from '@/lib/supabase';

/** Buckets contratados pelo NFR18. Não inventar outros (Artigo IV). */
export type RateLimitBucket = 'signup' | 'login' | 'reset' | 'track';

/**
 * Targets do NFR18 — FIXOS. `limit` requisições por `windowSeconds`, com a janela
 * fatiada em sub-buckets de `bucketSeconds`.
 * [Source: PRD NFR18 · ADR-001 § 3, tabela de targets]
 */
const TARGETS: Record<
  RateLimitBucket,
  { limit: number; windowSeconds: number; bucketSeconds: number }
> = {
  signup: { limit: 5, windowSeconds: 3600, bucketSeconds: 60 },
  login: { limit: 10, windowSeconds: 900, bucketSeconds: 60 },
  reset: { limit: 3, windowSeconds: 3600, bucketSeconds: 60 },
  track: { limit: 60, windowSeconds: 60, bucketSeconds: 10 },
};

/**
 * Mensagem de estouro para os endpoints de auth. Genérica DE PROPÓSITO:
 * não revela o mecanismo (nada de "rate limit", contadores ou Retry-After) e é
 * IDÊNTICA exista ou não a conta — não dá para enumerar contas por ela.
 * [Source: Story 6.4 AC12 · risco R2]
 */
export const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

/**
 * `RATE_LIMIT_PEPPER` ausente: o hash continua funcionando (o app NUNCA quebra por
 * causa disto), mas fica sujeito a enumeração — o espaço IPv4 tem 2^32 endereços e um
 * SHA-256 sem segredo é reversível por força bruta em minutos. Por isso a ausência é
 * avisada UMA VEZ no log do servidor, alto e claro, em vez de degradar em silêncio.
 * Não é uma credencial: seu vazamento permite correlacionar hashes de IP, e nada mais
 * — contraste didático com a service role key, que entregaria o banco inteiro.
 * [Source: Story 6.4 AC9/AC10 · risco R1]
 */
let warnedAboutPepper = false;

function pepper(): string {
  const value = process.env.RATE_LIMIT_PEPPER ?? '';
  if (!value && !warnedAboutPepper) {
    warnedAboutPepper = true;
    console.warn(
      '[rate-limit] RATE_LIMIT_PEPPER não definido — os hashes de IP ficam sujeitos a ' +
        'enumeração do espaço IPv4. O rate limiting CONTINUA ATIVO. Provisione o env ' +
        '(server-only, nunca NEXT_PUBLIC_*) em todos os ambientes.'
    );
  }
  return value;
}

/**
 * IP do cliente a partir dos headers da borda da Vercel.
 * USO EFÊMERO, EM MEMÓRIA — o valor nunca é gravado, logado nem enviado ao banco
 * (NFR19). Só o digest sai desta função.
 *
 * `x-forwarded-for` é uma lista "cliente, proxy1, proxy2": o PRIMEIRO elemento é o
 * cliente. Fallback para `x-real-ip` e, por fim, `'unknown'` — um balde compartilhado
 * que na Vercel não deve ser alcançado (o header sempre existe); é só uma guarda.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return h.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * SHA-256 de `[pepper, ...parts].join(':')` → 64 chars hex. Determinístico para as
 * mesmas partes e o mesmo pepper; muda inteiramente se o pepper mudar.
 * É o ÚNICO formato de identidade que chega ao banco.
 */
export function subjectHash(...parts: string[]): string {
  return createHash('sha256')
    .update([pepper(), ...parts].join(':'))
    .digest('hex');
}

/**
 * Consome uma unidade do bucket e diz se a requisição é permitida.
 * `true` = permitido (e já contabilizado); `false` = estourado.
 *
 * Deve ser chamada ANTES de qualquer trabalho caro na Server Action — é o ponto todo
 * de um limiter: cortar cedo.
 *
 * FAIL-OPEN em duas camadas: a função SQL já tem `exception when others → true`, e
 * aqui qualquer falha de rede/contexto também libera. Um limiter quebrado nunca
 * derruba o produto nem propaga exceção para a UI. [Source: AC5/AC14]
 *
 * @param bucket alvo do NFR18
 * @param extraKey parte adicional do subject — usada pelo bucket `track` (o linkId),
 *                 para que o limite seja por (visitante, link) e não global por IP.
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  extraKey?: string
): Promise<boolean> {
  try {
    const target = TARGETS[bucket];
    const ip = await clientIp();
    const subject = extraKey ? subjectHash(ip, extraKey) : subjectHash(ip);

    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_subject: subject,
      p_limit: target.limit,
      p_window_seconds: target.windowSeconds,
      p_bucket_seconds: target.bucketSeconds,
    });

    if (error) return true; // fail-open
    return data !== false;
  } catch {
    return true; // fail-open
  }
}
