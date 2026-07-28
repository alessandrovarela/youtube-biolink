// Story 6.4 (correção do gate da Wave 3) — o CAMINHO REAL DO APP, ponta a ponta.
//
// POR QUE ESTE ARQUIVO EXISTE, SEPARADO DO rate-limit.test.ts:
// aquele arquivo fala com o PostgREST na mão (é o que um ATACANTE faria). Este aqui
// exercita `checkRateLimit` de lib/rate-limit.ts — a MESMA função que signUp, signIn,
// requestPasswordReset e trackLinkClick chamam — contra o BANCO DE DEVELOPMENT REAL.
// A única coisa mockada é `next/headers`, porque fora de uma request do Next não existe
// header nenhum; o resto (derivação do subject, pepper, o wrapper SQL, a janela, os
// contadores) é o código de produção.
//
// O QUE ISSO PROVA, QUE NENHUM DOS OUTROS DOIS ARQUIVOS PROVAVA SOZINHO:
//   1. os 3 endpoints de auth continuam com rate limiting FUNCIONAL depois que a
//      primitiva `check_rate_limit` virou interna (issue #1) — o helper migrou para
//      `check_app_rate_limit` e o teto contratado pelo NFR18 é atingido de verdade;
//   2. o subject que o app produz É ACEITO pela validação de formato do wrapper;
//   3. 🔴 o vetor (b) do gate está fechado: o subject forjado com pepper VAZIO — o valor
//      exato que o @qa usou para negar login ao IP 203.0.113.77 — NÃO é o subject que o
//      app calcula com o pepper provisionado.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { createAdminClient, hasServiceRole } from './helpers/admin';

// Headers sintéticos: é a única peça que não pode ser real fora de uma request do Next.
let mockHeaders: Record<string, string | null> = {};
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (n: string) => mockHeaders[n.toLowerCase()] ?? null }),
}));

import { checkRateLimit, subjectHash, TARGETS } from '@/lib/rate-limit';

const suite = hasServiceRole() ? describe : describe.skip;

suite('Story 6.4 — rate limiting pelo CAMINHO DO APP (dev real)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const touched: Array<[string, string]> = [];

  beforeAll(() => {
    // O app NUNCA deve rodar sem pepper; fixamos um valor aqui para que o teste não
    // dependa do .env.local da máquina.
    //
    // 🔴 O SUFIXO ALEATÓRIO É O QUE TORNA ESTE ARQUIVO REEXECUTÁVEL. Antes o pepper era
    // a constante 'pepper-de-integracao-determinístico', e o último teste do arquivo
    // (vetor (b)) é o único que NÃO usa `freshIp()` — ele precisa do IP histórico
    // 203.0.113.77. Pepper fixo + IP fixo = subject FIXO, compartilhado por toda
    // execução da suíte. Como o bucket `login` tem janela de 900 s, duas execuções
    // dentro de 15 minutos (ou duas em paralelo na CI) somavam no MESMO contador e a
    // asserção `totalHits(...) === 1` via 2 → falha intermitente que sumia na
    // re-execução seguinte. Diagnosticado a partir de uma falha real da suíte completa.
    //
    // Com o pepper único por execução, o subject derivado é único por execução, e o
    // isolamento passa a valer para o arquivo inteiro — sem alterar o que o teste prova
    // (o `forged` continua sendo a constante histórica exata, computada SEM pepper).
    process.env.RATE_LIMIT_PEPPER = `pepper-de-integracao-${randomUUID()}`;
  });

  beforeEach(() => {
    mockHeaders = {};
  });

  afterAll(async () => {
    // Limpeza cirúrgica: só os pares (bucket, subject) que este arquivo criou.
    for (const [b, s] of touched) {
      await admin!.from('rate_limit_counters').delete().eq('bucket', b).eq('subject', s);
    }
  });

  /** Soma AUTORITATIVA de hits (a tabela é deny-all para anon/authenticated). */
  async function totalHits(bucket: string, subject: string): Promise<number> {
    const { data, error } = await admin!
      .from('rate_limit_counters')
      .select('hits')
      .eq('bucket', bucket)
      .eq('subject', subject);
    expect(error).toBeNull();
    return (data ?? []).reduce((s, r) => s + (r.hits as number), 0);
  }

  /** IP único por teste — isola execuções concorrentes e reexecuções da suíte. */
  function freshIp(): string {
    mockHeaders = { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}-${randomUUID()}` };
    return mockHeaders['x-forwarded-for']!;
  }

  // ── Os 3 endpoints de auth continuam limitados (AC11 / NFR18) ─────────
  const authBuckets = ['signup', 'login', 'reset'] as const;

  it.each(authBuckets)(
    '🔴 bucket %s: o app é barrado EXATAMENTE no teto do NFR18',
    async (bucket) => {
      const ip = freshIp();
      const subject = subjectHash(ip);
      touched.push([bucket, subject]);

      const { limit } = TARGETS[bucket];

      // Até o teto, tudo passa.
      for (let i = 1; i <= limit; i++) {
        expect(await checkRateLimit(bucket), `chamada #${i} deveria passar`).toBe(true);
      }

      // A seguinte é recusada — e é o que a Server Action traduz em RATE_LIMIT_MESSAGE.
      expect(await checkRateLimit(bucket)).toBe(false);

      // O consumo registrado é o teto, não o teto + as recusadas (AC3, risco R4).
      expect(await totalHits(bucket, subject)).toBe(limit);
    },
    60_000
  );

  it('o subject produzido pelo app é ACEITO pelo wrapper (formato 64-hex)', async () => {
    // Se a validação de formato do banco e a derivação do app divergissem, TODA chamada
    // viraria erro e o helper fail-open — o limiter estaria desligado sem ninguém notar.
    // Este teste é a trava contra esse modo de falha SILENCIOSO.
    const ip = freshIp();
    const subject = subjectHash(ip);
    touched.push(['login', subject]);

    expect(subject).toMatch(/^[0-9a-f]{64}$/);
    expect(await checkRateLimit('login')).toBe(true);
    // Se o wrapper tivesse recusado, o fail-open também devolveria `true` — por isso a
    // asserção que vale é a do BANCO: o hit foi realmente contabilizado.
    expect(await totalHits('login', subject)).toBe(1);
  }, 30_000);

  it('IPs diferentes têm baldes independentes (o limite é POR IP, não global)', async () => {
    const ipA = freshIp();
    const subjectA = subjectHash(ipA);
    touched.push(['login', subjectA]);
    for (let i = 0; i < TARGETS.login.limit; i++) expect(await checkRateLimit('login')).toBe(true);
    expect(await checkRateLimit('login')).toBe(false); // A estourou

    const ipB = freshIp();
    expect(ipB).not.toBe(ipA);
    touched.push(['login', subjectHash(ipB)]);
    expect(await checkRateLimit('login')).toBe(true); // B intacto
  }, 60_000);

  it('o bucket track chaveia por (ip, linkId) — um link estourado não derruba os outros', async () => {
    const ip = freshIp();
    const linkA = randomUUID();
    const linkB = randomUUID();
    touched.push(['track', subjectHash(ip, linkA)], ['track', subjectHash(ip, linkB)]);

    for (let i = 0; i < TARGETS.track.limit; i++) {
      expect(await checkRateLimit('track', linkA)).toBe(true);
    }
    expect(await checkRateLimit('track', linkA)).toBe(false);
    expect(await checkRateLimit('track', linkB)).toBe(true);
  }, 120_000);

  // ── 🔴 Vetor (b) do gate da Wave 3 — o pepper é o que o fecha ─────────
  it('🔴 o subject forjado com pepper VAZIO não é o subject do app (lockout inviável)', async () => {
    // O @qa calculou sha256(':' + ip) para 203.0.113.77 e, com aquele valor, negou login
    // ao IP por 15 minutos. Com o pepper provisionado, esse valor deixa de corresponder
    // a qualquer balde real: gastá-lo não afeta usuário nenhum.
    const victimIp = '203.0.113.77';
    const forged = createHash('sha256').update(['', victimIp].join(':')).digest('hex');
    expect(forged).toBe('684064235b913936c6e149acdfb5f37f154595d7e609ca73415cbf9d26ada393');

    mockHeaders = { 'x-forwarded-for': victimIp };
    const real = subjectHash(victimIp);
    touched.push(['login', real]);

    expect(real).not.toBe(forged);

    // E o balde REAL da vítima continua zerado mesmo depois de o atacante ter gastado o
    // balde forjado — porque são chaves diferentes.
    expect(await totalHits('login', forged)).toBe(0);
    expect(await checkRateLimit('login')).toBe(true);
    expect(await totalHits('login', real)).toBe(1);
  }, 30_000);
});
