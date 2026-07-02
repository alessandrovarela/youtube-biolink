// Helpers de agregação de cliques para o dashboard de analytics (Story 5.4).
// Consumidos pela Story 5.5 (dashboard). Constroem sobre a view `link_click_daily`
// (Story 5.4), que pré-agrega count(*) por (link_id, dia) usando o índice
// (link_id, clicked_at desc) da Story 5.1.
//
// AUTHZ APPLICATION-LAYER (sem RLS no MVP, igual às demais leituras — Story 3.5):
// primeiro buscamos os link_ids do próprio profile (`links.profile_id = profileId`,
// equivalente ao `auth.uid()` que o Epic 6 usará) e só então consultamos a view
// restrita a esses ids. Fazer o filtro em duas queries (em vez de um join embutido
// na view) é deliberado: a view não declara FK para `links`, então o PostgREST não
// inferiria o relacionamento de forma confiável; o mesmo padrão de duas leituras já
// é usado em lib/queries/public-page.ts. O resultado é idêntico ao do join por
// profile_id — nunca lemos cliques de links que não pertencem ao profile.
//
// O client Supabase é injetado por parâmetro (como em public-page.ts) para manter
// os helpers testáveis isoladamente, sem depender do contexto de request do Next.
// [Source: prd.md § 6 Story 5.4; architecture.md § 2.5 (app-layer authz); ER.md]
import type { SupabaseClient } from '@supabase/supabase-js';

/** Total de cliques de um link + recortes 7d/30d (colunas da tabela da Story 5.5). */
export interface LinkClickTotals {
  link_id: string;
  title: string;
  total: number;
  last7: number;
  last30: number;
}

/** Ponto da série diária agregada (todos os links do profile). Dia em UTC. */
export interface DailyClickPoint {
  day: string; // 'YYYY-MM-DD' (UTC)
  clicks: number;
}

/** Linha crua da view `link_click_daily`. */
interface DailyRow {
  link_id: string;
  day: string;
  clicks: number;
}

/** Data UTC (YYYY-MM-DD) de `n` dias atrás. n=0 → hoje. */
function utcDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Links do profile (id + título), ordenados por `position`. É a fronteira de
 * autorização app-layer: define quais link_ids as agregações podem enxergar.
 */
async function fetchProfileLinks(
  supabase: SupabaseClient,
  profileId: string
): Promise<Array<{ id: string; title: string }>> {
  const { data, error } = await supabase
    .from('links')
    .select('id, title, position')
    .eq('profile_id', profileId)
    .order('position', { ascending: true });
  if (error || !data) return [];
  return data.map((l) => ({ id: l.id as string, title: l.title as string }));
}

/**
 * Total de cliques por link do `profileId`, incluindo links com 0 cliques
 * (semântica de LEFT JOIN garantida ao partir da lista completa de links e
 * preencher zeros). Também traz os recortes `last7`/`last30` — baratos porque a
 * série diária por link já é lida aqui. Comparação de datas em 'YYYY-MM-DD' é
 * lexicográfica == cronológica.
 */
export async function getClicksByLink(
  supabase: SupabaseClient,
  profileId: string
): Promise<LinkClickTotals[]> {
  const links = await fetchProfileLinks(supabase, profileId);
  if (links.length === 0) return [];

  const linkIds = links.map((l) => l.id);
  const { data, error } = await supabase
    .from('link_click_daily')
    .select('link_id, day, clicks')
    .in('link_id', linkIds);

  const rows: DailyRow[] = error || !data ? [] : (data as DailyRow[]);

  const since7 = utcDaysAgo(6); // janela de 7 dias inclui hoje
  const since30 = utcDaysAgo(29); // janela de 30 dias inclui hoje

  const acc = new Map<string, { total: number; last7: number; last30: number }>();
  for (const l of links) acc.set(l.id, { total: 0, last7: 0, last30: 0 });

  for (const r of rows) {
    const a = acc.get(r.link_id);
    if (!a) continue; // defesa extra: ignora ids fora do profile
    a.total += r.clicks;
    if (r.day >= since30) a.last30 += r.clicks;
    if (r.day >= since7) a.last7 += r.clicks;
  }

  return links.map((l) => {
    const a = acc.get(l.id)!;
    return { link_id: l.id, title: l.title, total: a.total, last7: a.last7, last30: a.last30 };
  });
}

/**
 * Série diária contínua de cliques (agregado de todos os links do `profileId`)
 * para os últimos `days` dias, terminando hoje (UTC). Dias sem clique são
 * preenchidos com 0 no lado TS — a Story 5.5 precisa de série contínua p/ o
 * gráfico. Ordenada do mais antigo ao mais recente.
 */
export async function getDailyClicks(
  supabase: SupabaseClient,
  profileId: string,
  days: number
): Promise<DailyClickPoint[]> {
  const window = Math.max(1, Math.floor(days));

  // Série base (0 em todos os dias), com índice dia → posição p/ merge O(1).
  const series: DailyClickPoint[] = [];
  const index = new Map<string, number>();
  for (let i = window - 1; i >= 0; i--) {
    const day = utcDaysAgo(i);
    index.set(day, series.length);
    series.push({ day, clicks: 0 });
  }

  const links = await fetchProfileLinks(supabase, profileId);
  if (links.length === 0) return series;

  const linkIds = links.map((l) => l.id);
  const cutoff = utcDaysAgo(window - 1);
  const { data, error } = await supabase
    .from('link_click_daily')
    .select('day, clicks')
    .in('link_id', linkIds)
    .gte('day', cutoff);

  if (error || !data) return series;

  for (const r of data as Array<{ day: string; clicks: number }>) {
    const i = index.get(r.day);
    if (i !== undefined) series[i].clicks += r.clicks;
  }
  return series;
}
