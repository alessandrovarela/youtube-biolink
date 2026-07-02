// Story 5.5 — Seletor de período (7 / 30 / 90 dias) via searchParams (?days=N).
// Server component: são links de navegação (não estado client), mantendo o SSR —
// a página relê `searchParams` e reconsulta os helpers no servidor. Padrão visual
// espelha o toggle de abas da nav (rounded-pill sobre bg-muted).
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Períodos válidos do toggle. Fonte única para page e componente. */
export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
export const DEFAULT_PERIOD: AnalyticsPeriod = 30;

/** Normaliza `?days=` para um período válido (default 30). Puro/testável. */
export function parsePeriod(raw: string | undefined): AnalyticsPeriod {
  const n = Number(raw);
  return (ANALYTICS_PERIODS as readonly number[]).includes(n)
    ? (n as AnalyticsPeriod)
    : DEFAULT_PERIOD;
}

export function PeriodToggle({ active }: { active: AnalyticsPeriod }) {
  return (
    <nav
      className="inline-flex items-center gap-1 rounded-pill bg-muted p-1"
      aria-label="Período de análise"
    >
      {ANALYTICS_PERIODS.map((days) => {
        const isActive = days === active;
        return (
          <Link
            key={days}
            href={`/dashboard/analytics?days=${days}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-pill px-4 py-1.5 text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-surface text-fg shadow-[var(--shadow-sm)]'
                : 'text-muted-fg hover:text-fg'
            )}
          >
            {days} dias
          </Link>
        );
      })}
    </nav>
  );
}
