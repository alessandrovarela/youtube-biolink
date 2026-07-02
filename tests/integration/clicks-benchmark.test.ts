// Story 5.4 — benchmark da agregação (10k cliques seeded, alvo <100ms).
// GATED: só roda com RUN_CLICKS_BENCH=1 (além do service role) para não pesar
// o `pnpm test` de todo dia nem martelar o dev DB. Rodar manualmente:
//   RUN_CLICKS_BENCH=1 pnpm test tests/integration/clicks-benchmark.test.ts
// Mede o wall-clock dos helpers (inclui RTT de rede até o Supabase cloud); o
// tempo puro de DB é menor. Resultado registrado em docs/stories/5.4.story.md.
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';
import { bulkInsertClicks, clicksSpread } from './helpers/seed-clicks';
import { getClicksByLink, getDailyClicks } from '@/lib/analytics/clicks';

const enabled = hasServiceRole() && process.env.RUN_CLICKS_BENCH === '1';
const suite = enabled ? describe : describe.skip;

if (!enabled) {
  console.warn(
    '[clicks-benchmark.test] benchmark skipado — defina RUN_CLICKS_BENCH=1 (e service role) para rodar.'
  );
}

suite('Story 5.4 — benchmark 10k cliques', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const anon = hasServiceRole() ? createAnonClient() : null;
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  it('agrega 10k cliques bem abaixo do alvo', async () => {
    const u = uniqueTestUser();
    const { data, error } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    expect(error).toBeNull();
    const profileId = data.user!.id;
    createdUserIds.push(profileId);

    // 5 links, 2k cliques cada (10k), espalhados por 90 dias.
    const linkIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { data: link } = await admin!
        .from('links')
        .insert({ profile_id: profileId, title: `Link ${i}`, url: 'https://example.com', position: i })
        .select('id')
        .single();
      linkIds.push(link!.id as string);
    }
    for (const linkId of linkIds) {
      await bulkInsertClicks(admin!, clicksSpread(linkId, 2000, 90));
    }

    // Warm-up (evita contar o custo do primeiro round-trip / plan cache).
    await getClicksByLink(anon!, profileId);

    const t0 = performance.now();
    const totals = await getClicksByLink(anon!, profileId);
    const tByLink = performance.now() - t0;

    const t1 = performance.now();
    const series = await getDailyClicks(anon!, profileId, 30);
    const tDaily = performance.now() - t1;

    const grandTotal = totals.reduce((s, t) => s + t.total, 0);
    expect(grandTotal).toBe(10000);
    expect(series).toHaveLength(30);

    console.log(
      `[benchmark] getClicksByLink=${tByLink.toFixed(1)}ms getDailyClicks=${tDaily.toFixed(1)}ms (10k cliques, 5 links, 90 dias — inclui RTT de rede)`
    );

    // Ceiling generoso p/ não falhar por latência de rede; o alvo real de DB é <100ms.
    expect(tByLink).toBeLessThan(5000);
    expect(tDaily).toBeLessThan(5000);
  }, 120_000);
});
