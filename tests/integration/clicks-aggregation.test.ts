// Story 5.4 — teste de integração da agregação de cliques (view + helpers).
// Valida, contra o dev: contagem por link (incl. links com 0 cliques), série
// diária contínua, recortes 7d/30d e isolamento por profile (authz app-layer).
// Requer SERVICE_ROLE_KEY para setup/teardown; sem o secret o bloco é skipado
// (mesmo padrão de link-clicks.test.ts).
import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, createAnonClient, hasServiceRole } from './helpers/admin';
import { uniqueTestUser } from './helpers/unique-user';
import { deleteTestUsers } from './helpers/cleanup';
import { bulkInsertClicks, clicksOnDay } from './helpers/seed-clicks';
import { getClicksByLink, getDailyClicks } from '@/lib/analytics/clicks';

const suite = hasServiceRole() ? describe : describe.skip;

if (!hasServiceRole()) {
  console.warn(
    '[clicks-aggregation.test] SUPABASE_SERVICE_ROLE_KEY ausente — teste de agregação skipado.'
  );
}

suite('Story 5.4 — agregação de cliques (view + helpers)', () => {
  const admin = hasServiceRole() ? createAdminClient() : null;
  const anon = hasServiceRole() ? createAnonClient() : null;
  const createdUserIds: string[] = [];

  async function createUserWithProfile(): Promise<string> {
    const u = uniqueTestUser();
    const { data, error } = await admin!.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username },
    });
    expect(error).toBeNull();
    const userId = data.user!.id;
    createdUserIds.push(userId);
    return userId;
  }

  async function createLink(profileId: string, title: string, position: number): Promise<string> {
    const { data, error } = await admin!
      .from('links')
      .insert({ profile_id: profileId, title, url: 'https://example.com', position })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  afterAll(async () => {
    // ON DELETE CASCADE remove profiles, links e link_clicks dos usuários de teste.
    if (admin && createdUserIds.length) await deleteTestUsers(admin, createdUserIds);
  });

  it('getClicksByLink: total por link, recortes 7d/30d, e links com 0 cliques', async () => {
    const profileA = await createUserWithProfile();
    const linkA1 = await createLink(profileA, 'Canal', 0);
    const linkA2 = await createLink(profileA, 'Sem cliques', 1);

    // linkA1: 3 hoje + 2 há 5 dias (dentro de 7d) + 1 há 40 dias (fora de 30d).
    // linkA2: nenhum clique.
    await bulkInsertClicks(admin!, [
      ...clicksOnDay(linkA1, 0, 3),
      ...clicksOnDay(linkA1, 5, 2),
      ...clicksOnDay(linkA1, 40, 1),
    ]);

    const totals = await getClicksByLink(anon!, profileA);
    // Ambos os links retornam, ordenados por position — incl. o de 0 cliques.
    expect(totals).toHaveLength(2);

    const a1 = totals.find((t) => t.link_id === linkA1)!;
    const a2 = totals.find((t) => t.link_id === linkA2)!;
    expect(a1.title).toBe('Canal');
    expect(a1.total).toBe(6); // 3 + 2 + 1
    expect(a1.last7).toBe(5); // 3 (hoje) + 2 (há 5 dias)
    expect(a1.last30).toBe(5); // exclui o de 40 dias
    expect(a2.total).toBe(0);
    expect(a2.last7).toBe(0);
    expect(a2.last30).toBe(0);
  });

  it('getDailyClicks: série contínua com dias sem clique preenchidos com 0', async () => {
    const profile = await createUserWithProfile();
    const link = await createLink(profile, 'Canal', 0);

    await bulkInsertClicks(admin!, [
      ...clicksOnDay(link, 0, 4), // hoje
      ...clicksOnDay(link, 3, 2), // há 3 dias
    ]);

    const series = await getDailyClicks(anon!, profile, 7);
    expect(series).toHaveLength(7); // série contínua de 7 dias
    // Ordenada do mais antigo (índice 0) ao mais recente (índice 6 = hoje).
    expect(series[6].clicks).toBe(4); // hoje
    expect(series[3].clicks).toBe(2); // há 3 dias
    // Dias sem clique preenchidos com 0.
    expect(series[5].clicks).toBe(0);
    expect(series[0].clicks).toBe(0);
    const totalSerie = series.reduce((s, p) => s + p.clicks, 0);
    expect(totalSerie).toBe(6);
  });

  it('isolamento por profile: A não vê cliques dos links de B', async () => {
    const profileA = await createUserWithProfile();
    const profileB = await createUserWithProfile();
    const linkA = await createLink(profileA, 'Link A', 0);
    const linkB = await createLink(profileB, 'Link B', 0);

    await bulkInsertClicks(admin!, [
      ...clicksOnDay(linkA, 0, 2),
      ...clicksOnDay(linkB, 0, 9),
    ]);

    const totalsA = await getClicksByLink(anon!, profileA);
    expect(totalsA).toHaveLength(1);
    expect(totalsA[0].link_id).toBe(linkA);
    expect(totalsA[0].total).toBe(2); // não soma os 9 cliques de B

    const seriesA = await getDailyClicks(anon!, profileA, 30);
    expect(seriesA.reduce((s, p) => s + p.clicks, 0)).toBe(2);

    // Simetria: B só enxerga os próprios 9.
    const totalsB = await getClicksByLink(anon!, profileB);
    expect(totalsB).toHaveLength(1);
    expect(totalsB[0].total).toBe(9);
  });

  it('profile sem links: getClicksByLink=[] e getDailyClicks série de zeros', async () => {
    const profile = await createUserWithProfile();
    expect(await getClicksByLink(anon!, profile)).toEqual([]);

    const series = await getDailyClicks(anon!, profile, 7);
    expect(series).toHaveLength(7);
    expect(series.every((p) => p.clicks === 0)).toBe(true);
  });
});
