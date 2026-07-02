// Story 5.5 — Dashboard de analytics de cliques. Server component sob o auth guard
// do layout (2.9); guard defensivo próprio (layout e page renderizam concorrentes).
// Lê o profile do usuário logado (getUser → profiles) e chama os helpers da Story 5.4
// com o client server-side. Período (7/30/90) vem de `searchParams` → SSR puro.
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { getClicksByLink, getDailyClicks } from '@/lib/analytics/clicks';
import { Card } from '@/components/ui/Card';
import { ClicksChart } from '@/components/dashboard/analytics/clicks-chart';
import { ClicksTable } from '@/components/dashboard/analytics/clicks-table';
import { AnalyticsEmptyState } from '@/components/dashboard/analytics/empty-state';
import { PeriodToggle, parsePeriod } from '@/components/dashboard/analytics/period-toggle';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/dashboard/analytics');

  const { days: daysParam } = await searchParams;
  const days = parsePeriod(daysParam);

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();
  const username = (profile as { username?: string } | null)?.username ?? null;

  const [byLink, daily] = await Promise.all([
    getClicksByLink(supabase, user.id),
    getDailyClicks(supabase, user.id, days),
  ]);

  const totalClicks = byLink.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <PeriodToggle active={days} />
      </div>

      {totalClicks === 0 ? (
        <Card>
          <AnalyticsEmptyState username={username} />
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Cliques por dia</h2>
              <p className="text-sm text-muted-fg">
                Total de {totalClicks.toLocaleString('pt-BR')} cliques nos últimos {days} dias.
              </p>
            </div>
            <ClicksChart series={daily} days={days} />
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Cliques por link</h2>
            <ClicksTable rows={byLink} />
          </Card>
        </>
      )}
    </div>
  );
}
