// Story 6.4 — integração: rate limiting validado NO BANCO (dev real, não mocks).
//
// Este arquivo é o TESTE-CHAVE da story. Ele fala DIRETO com o PostgREST usando a anon
// key — exatamente o que um atacante de posse da anon key pública faria — e prova que
// o teto agora alcança esse caminho.
//
// FECHA O CONCERN #1 (medium) DO GATE DA WAVE 2: o gate provou por probe que 20
// chamadas curl diretas a POST /rest/v1/rpc/record_link_click gravavam 20 cliques
// forjados sem tocar no Next.js, porque o rate limiting planejado vivia só na Server
// Action. O teto passou para DENTRO da RPC (camada 1) e o teste "61 chamadas diretas"
// abaixo é a prova de fechamento.
//
// A JANELA DESLIZANTE É TESTADA AQUI, contra a função SQL real, e não em unit com uma
// reimplementação em TS (que seria tautológica). Cobertos: dentro do limite passa, no
// limite exato bloqueia, "já estourou NÃO incrementa" e virada de janela.
//
// Requer SUPABASE_SERVICE_ROLE_KEY (setup/teardown + releitura AUTORITATIVA dos
// contadores — a tabela rate_limit_counters é deny-all para anon/authenticated, então
// só o service role consegue auditá-la).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn('[rate-limit.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste skipado.');
}

/** Teto por link contratado pela Emenda 1 do ADR-001: 60 cliques/min/link. */
const TRACK_LINK_LIMIT = 60;

/** Digest hex de 64 chars — formato obrigatório do subject derivado de IP (NFR19). */
const HEX64 = /^[0-9a-f]{64}$/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

suite('Story 6.4 — rate limiting (db-layer, dev real)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const createdUserIds: string[] = [];
  const usedBuckets: string[] = [];

  let anon: SupabaseClient;
  let activeLink = '';

  /** Bucket único por teste: isola execuções concorrentes e reexecuções da suíte. */
  function freshBucket(): string {
    const b = `test_${randomUUID()}`;
    usedBuckets.push(b);
    return b;
  }

  /** Chama a função SQL de limite com parâmetros explícitos (não os targets do app). */
  async function callLimit(
    bucket: string,
    subject: string,
    limit: number,
    windowSeconds: number,
    bucketSeconds = 60
  ): Promise<boolean> {
    const { data, error } = await anon.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_subject: subject,
      p_limit: limit,
      p_window_seconds: windowSeconds,
      p_bucket_seconds: bucketSeconds,
    });
    expect(error).toBeNull();
    return data as boolean;
  }

  /** Soma AUTORITATIVA de hits de uma chave (service role — a tabela é deny-all). */
  async function totalHits(bucket: string, subject: string): Promise<number> {
    const { data, error } = await admin!
      .from('rate_limit_counters')
      .select('hits')
      .eq('bucket', bucket)
      .eq('subject', subject);
    expect(error).toBeNull();
    return (data ?? []).reduce((sum, r) => sum + (r.hits as number), 0);
  }

  async function countClicks(linkId: string): Promise<number> {
    const { data, error } = await admin!.from('link_clicks').select('id').eq('link_id', linkId);
    expect(error).toBeNull();
    return data!.length;
  }

  beforeAll(async () => {
    const u = uniqueTestUser();
    const { data, error } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    expect(error).toBeNull();
    createdUserIds.push(data.user!.id);

    const { data: link, error: linkErr } = await admin!
      .from('links')
      .insert({
        profile_id: data.user!.id,
        title: 'Alvo do rate limit',
        url: 'https://example.com/',
        position: 0,
        is_active: true,
      })
      .select('id')
      .single();
    expect(linkErr).toBeNull();
    activeLink = link!.id as string;

    anon = createAnonClient();
  });

  afterAll(async () => {
    // Limpa APENAS o que este arquivo criou — nada de `delete` sem filtro.
    if (admin) {
      for (const b of usedBuckets) {
        await admin.from('rate_limit_counters').delete().eq('bucket', b);
      }
      if (activeLink) {
        await admin.from('rate_limit_counters').delete().eq('bucket', 'track_link').eq('subject', activeLink);
      }
      if (createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
    }
  });

  // ── AC2 — a tabela de contadores é PURAMENTE INTERNA ────────────────────

  it('rate_limit_counters é invisível para anon (RLS deny-all + sem grant)', async () => {
    const { data, error } = await anon.from('rate_limit_counters').select('bucket, subject, hits');

    // Sem grant de SELECT, o PostgREST devolve permission denied — não uma lista vazia.
    expect(error).not.toBeNull();
    expect(String(error!.message).toLowerCase()).toContain('permission denied');
    expect(data).toBeNull();
  });

  it('anon não consegue escrever em rate_limit_counters (nem zerar o próprio contador)', async () => {
    const { error } = await anon
      .from('rate_limit_counters')
      .insert({ bucket: 'forjado', subject: 'x', window_start: new Date().toISOString(), hits: 0 });
    expect(error).not.toBeNull();
  });

  // ── AC3/AC15 — janela deslizante ────────────────────────────────────────

  it('dentro do limite: todas as chamadas passam e cada uma conta 1', async () => {
    const bucket = freshBucket();
    const subject = 'a'.repeat(64);

    for (let i = 0; i < 3; i++) {
      expect(await callLimit(bucket, subject, 5, 3600)).toBe(true);
    }
    expect(await totalHits(bucket, subject)).toBe(3);
  });

  it('no limite EXATO a próxima chamada é bloqueada', async () => {
    const bucket = freshBucket();
    const subject = 'b'.repeat(64);

    for (let i = 0; i < 3; i++) {
      expect(await callLimit(bucket, subject, 3, 3600)).toBe(true);
    }
    // A 4ª estoura: o consumo (3) já alcançou o limite (3).
    expect(await callLimit(bucket, subject, 3, 3600)).toBe(false);
  });

  it('🔴 requisição ESTOURADA não incrementa (não estende a própria punição)', async () => {
    // Se cada bloqueio também contasse, um cliente em loop nunca sairia do castigo:
    // a janela seria continuamente realimentada. [ADR-001 § 3 · risco R4]
    const bucket = freshBucket();
    const subject = 'c'.repeat(64);

    for (let i = 0; i < 3; i++) await callLimit(bucket, subject, 3, 3600);
    expect(await totalHits(bucket, subject)).toBe(3);

    // 10 tentativas rejeitadas em sequência.
    for (let i = 0; i < 10; i++) {
      expect(await callLimit(bucket, subject, 3, 3600)).toBe(false);
    }

    // O contador NÃO se moveu: continua exatamente 3, não 13.
    expect(await totalHits(bucket, subject)).toBe(3);
  }, 60_000);

  it('após a janela expirar, o chamador volta a passar (virada de janela)', async () => {
    // Janela curta de propósito (2s, sub-buckets de 1s) para exercitar a virada em
    // tempo real contra a função SQL de verdade.
    const bucket = freshBucket();
    const subject = 'd'.repeat(64);

    expect(await callLimit(bucket, subject, 2, 2, 1)).toBe(true);
    expect(await callLimit(bucket, subject, 2, 2, 1)).toBe(true);
    expect(await callLimit(bucket, subject, 2, 2, 1)).toBe(false); // estourou

    await sleep(2600); // os sub-buckets antigos saem da janela deslizante

    expect(await callLimit(bucket, subject, 2, 2, 1)).toBe(true);
  }, 30_000);

  it('chaves diferentes têm contadores independentes', async () => {
    const bucket = freshBucket();
    const s1 = 'e'.repeat(64);
    const s2 = 'f'.repeat(64);

    expect(await callLimit(bucket, s1, 1, 3600)).toBe(true);
    expect(await callLimit(bucket, s1, 1, 3600)).toBe(false); // s1 estourou

    expect(await callLimit(bucket, s2, 1, 3600)).toBe(true); // s2 intacto
  });

  // ── AC17 / NFR19 — nenhum IP raw persistido ─────────────────────────────

  it('nenhuma coluna guarda IP: os subjects dos buckets de app são 64 hex', async () => {
    const { data, error } = await admin!
      .from('rate_limit_counters')
      .select('bucket, subject')
      .in('bucket', ['signup', 'login', 'reset', 'track']);

    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.subject as string).toMatch(HEX64);
    }
  });

  // ── EMENDA 1 / concern #1 do gate da Wave 2 — O TESTE-CHAVE ─────────────

  it('🔴 61 chamadas DIRETAS à RPC: 60 gravam, a 61ª é barrada sem inserir', async () => {
    // ESTE É O TESTE QUE FECHA O VETOR PROVADO PELO GATE DA WAVE 2.
    // Nenhuma Server Action é envolvida: fala-se com o PostgREST pela anon key pública,
    // que é o caminho onde o rate limiting da camada 2 NUNCA seria avaliado.
    const before = await countClicks(activeLink);

    let allowed = 0;
    let denied = 0;
    for (let i = 0; i < TRACK_LINK_LIMIT + 1; i++) {
      const { data, error } = await anon.rpc('record_link_click', {
        p_link_id: activeLink,
        p_user_agent_short: 'DIRECT-RPC-PROBE',
      });
      expect(error).toBeNull();
      if (data === true) allowed++;
      else denied++;
    }

    expect(allowed).toBe(TRACK_LINK_LIMIT); // exatamente 60 gravaram
    expect(denied).toBe(1); // a 61ª foi barrada

    // E o banco confirma: cresceu 60, não 61.
    expect(await countClicks(activeLink)).toBe(before + TRACK_LINK_LIMIT);

    // Chamadas adicionais continuam barradas e continuam NÃO inserindo.
    const { data: extra } = await anon.rpc('record_link_click', {
      p_link_id: activeLink,
      p_user_agent_short: 'DIRECT-RPC-PROBE',
    });
    expect(extra).toBe(false);
    expect(await countClicks(activeLink)).toBe(before + TRACK_LINK_LIMIT);
  }, 180_000);

  it('o teto por link usa o link_id como subject (uuid, não é PII — nada a hashear)', async () => {
    const { data, error } = await admin!
      .from('rate_limit_counters')
      .select('subject, hits')
      .eq('bucket', 'track_link')
      .eq('subject', activeLink);

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    // Soma dos sub-buckets = exatamente o teto (os bloqueios não incrementaram).
    const sum = data!.reduce((s, r) => s + (r.hits as number), 0);
    expect(sum).toBe(TRACK_LINK_LIMIT);
  });

  it('o teto é POR LINK: outro link ativo continua gravando normalmente', async () => {
    // Prova que o backstop não é um interruptor global de desligar o tracking.
    const { data: other, error } = await admin!
      .from('links')
      .insert({
        profile_id: createdUserIds[0],
        title: 'Outro link',
        url: 'https://example.org/',
        position: 1,
        is_active: true,
      })
      .select('id')
      .single();
    expect(error).toBeNull();

    const { data: ok } = await anon.rpc('record_link_click', {
      p_link_id: other!.id,
      p_user_agent_short: 'OUTRO-LINK',
    });
    expect(ok).toBe(true);

    await admin!.from('rate_limit_counters').delete().eq('bucket', 'track_link').eq('subject', other!.id);
  });

  // ── ARMADILHA DO @architect: nenhuma sobrecarga sem teto publicada ──────

  it('🔴 existe UMA só assinatura de record_link_click publicada — sem sobrecarga', async () => {
    // POR QUE ISTO IMPORTA: se um parâmetro fosse ACRESCENTADO à RPC (a v2 de 3 args do
    // § 6.4 do ADR, descartada pelo @pm), o `create or replace` criaria uma SOBRECARGA:
    // a assinatura antiga (uuid, text) continuaria existindo, `grant execute to anon` e
    // SEM TETO — o bypass permaneceria publicado. Como a assinatura NÃO mudou nesta
    // versão, o replace substitui o corpo e nada fica órfão. Este teste é a trava de
    // regressão: o schema publicado pelo PostgREST tem que declarar exatamente estes
    // dois parâmetros.
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
    });
    expect(res.ok).toBe(true);

    const spec = (await res.json()) as {
      paths: Record<string, { post?: { parameters?: Array<{ schema?: { properties?: object } }> }}>;
    };

    const rpc = spec.paths['/rpc/record_link_click'];
    expect(rpc).toBeDefined();

    const props = Object.keys(rpc.post!.parameters![0].schema!.properties!).sort();
    // Se uma sobrecarga com parâmetro extra existisse, ele apareceria aqui.
    expect(props).toEqual(['p_link_id', 'p_user_agent_short']);
  }, 30_000);
});
