// Story 6.4 — Rate limiting application-layer (camada 2).
//
// Wrapper fino sobre a função SQL `check_app_rate_limit` (migration 20260719200000 —
// antes era `check_rate_limit`, que deixou de ser chamável por anon; ver issue #1 do
// gate da Wave 3 e o cabeçalho daquela migration).
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
 * Targets do NFR18 — FIXOS, e desde a correção da issue #1 do gate da Wave 3 eles NÃO
 * SÃO MAIS ENVIADOS AO BANCO: vivem hardcoded dentro de `check_app_rate_limit`
 * (migration 20260719200000). O chamador escolhe apenas QUEM ele é (o subject); QUANTO
 * ele pode é decisão do banco.
 *
 * Esta constante permanece aqui como DOCUMENTAÇÃO E TRAVA DE CONTRATO: os testes de
 * integração comparam estes números com o comportamento observado da função SQL, então
 * um drift entre as duas cópias é detectado pela suíte em vez de passar em silêncio.
 * [Source: PRD NFR18 · ADR-001 § 3 · gate Wave 3 issue #1]
 */
export const TARGETS: Record<
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
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ RATE_LIMIT_PEPPER — OBRIGATÓRIO EM PRODUÇÃO (issue #2 do gate da Wave 3)    │
 * └────────────────────────────────────────────────────────────────────────────┘
 * Até a Wave 3 a ausência do pepper era descrita como degradação de PRIVACIDADE
 * ("permite correlacionar hashes de IP") e o app degradava com um aviso no log. O gate
 * PROVOU que a classificação estava errada por uma ordem de grandeza:
 *
 *   com pepper vazio, o subject de auth é `sha256(':' + ip)` — uma função PÚBLICA, sem
 *   segredo. O atacante não precisa "enumerar" nada: ele FORJA o balde de um IP
 *   escolhido. 10 requisições anônimas negavam login àquele IP por 15 minutos.
 *
 * Ou seja: o pepper não é higiene de privacidade, é o CONTROLE DE SEGURANÇA que torna o
 * `subject` imprevisível para quem não é o app. É o que impede o único vetor que a
 * migration 20260719200000 não consegue fechar sozinha — o subject precisa vir do app,
 * porque só o app enxerga o IP do visitante.
 *
 * POR ISSO O COMPORTAMENTO MUDOU DE "DEGRADAR" PARA "FALHAR ALTO":
 *   • production sem pepper → lança na CARGA DO MÓDULO. O app não sobe. Um deploy mal
 *     provisionado quebra ruidosamente no boot, e não silenciosamente meses depois numa
 *     campanha de lockout que ninguém correlaciona. Fail-fast > fail-silent quando o
 *     que falha é um controle de segurança.
 *   • development/test sem pepper → fallback fixo e documentado + aviso ÚNICO e
 *     explícito. Dev não pode exigir provisionamento manual para `pnpm dev` funcionar,
 *     mas a diferença tem que estar registrada, não escondida.
 *
 * NÃO É UMA CREDENCIAL PRIVILEGIADA (contraste didático com a service role key, que
 * entregaria o banco inteiro): vazar o pepper permite forjar baldes de rate limit — um
 * problema de DISPONIBILIDADE —, não ler nem escrever dado de produto.
 * [Source: Story 6.4 AC9/AC10 · risco R1 · gate Wave 3 issue #2]
 */
const DEV_PEPPER_FALLBACK = 'dev-only-insecure-pepper-nao-usar-fora-de-development';

const MISSING_PEPPER_ERROR =
  '[rate-limit] RATE_LIMIT_PEPPER é OBRIGATÓRIO em produção e não está definido. ' +
  'Sem ele o subject dos buckets de auth é sha256(":"+ip) — computável por qualquer ' +
  'um — e um atacante nega login a IPs arbitrários (lockout). Provisione o env ' +
  '(server-only, NUNCA NEXT_PUBLIC_*, `openssl rand -hex 32`, valor distinto por ' +
  'ambiente) em production E preview antes do deploy.';

let warnedAboutPepper = false;

export function pepper(): string {
  const value = (process.env.RATE_LIMIT_PEPPER ?? '').trim();
  if (value) return value;

  // FALHA ALTO em produção — nunca degrada silenciosamente um controle de segurança.
  if (process.env.NODE_ENV === 'production') throw new Error(MISSING_PEPPER_ERROR);

  if (!warnedAboutPepper) {
    warnedAboutPepper = true;
    console.warn(
      '[rate-limit] RATE_LIMIT_PEPPER não definido — usando o fallback FIXO de ' +
        'development. Os subjects são previsíveis e forjáveis: aceitável só fora de ' +
        'produção. Em production a ausência do env LANÇA e o app não sobe.'
    );
  }
  return DEV_PEPPER_FALLBACK;
}

// Gate de INICIALIZAÇÃO: em produção a falta do pepper derruba a carga do módulo, e não
// a primeira requisição. Falhar no boot é o que garante que um ambiente mal
// provisionado nunca chegue a servir tráfego achando que está protegido.
if (process.env.NODE_ENV === 'production') pepper();

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
    const ip = await clientIp();
    const subject = extraKey ? subjectHash(ip, extraKey) : subjectHash(ip);

    // 🔴 `check_app_rate_limit`, NÃO `check_rate_limit` (gate Wave 3, issue #1).
    // A primitiva genérica virou INTERNA: anon perdeu o EXECUTE nela. Aqui só se envia
    // QUEM é o chamador (o subject hasheado); o bucket é validado contra uma allowlist
    // e os limites são hardcoded DENTRO da função SQL. Não há mais como um cliente com
    // a anon key escolher balde, limite ou janela — era o que permitia esgotar o balde
    // de um link de terceiro e forjar lockout de auth.
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc('check_app_rate_limit', {
      p_bucket: bucket,
      p_subject: subject,
    });

    if (error) return true; // fail-open
    return data !== false;
  } catch {
    return true; // fail-open
  }
}
