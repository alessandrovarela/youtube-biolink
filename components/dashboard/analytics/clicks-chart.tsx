// Story 5.5 — Gráfico de linha inline-SVG dos cliques diários (agregado de todos
// os links). Zero dependência de libs de chart (guia `dataviz`): série única, então
// SEM legenda (o título nomeia o dado); linha 2px em `accent`, área em wash ~10%,
// grid/eixos hairline recessivos em `border`, textos em tokens (`muted-fg`).
// Server component puro — a matemática vem de lib/analytics/chart.ts.
// Acessibilidade: <svg role="img" aria-label> + tabela alternativa sr-only.
import type { DailyClickPoint } from '@/lib/analytics/clicks';
import { buildLineChart, formatCount, formatDayShort } from '@/lib/analytics/chart';

export function ClicksChart({ series, days }: { series: DailyClickPoint[]; days: number }) {
  const geo = buildLineChart(series);
  const total = series.reduce((s, p) => s + p.clicks, 0);
  const peak = series.reduce<DailyClickPoint | null>(
    (best, p) => (best === null || p.clicks > best.clicks ? p : best),
    null
  );
  const first = series[0];
  const last = series[series.length - 1];

  const ariaLabel =
    `Cliques por dia nos últimos ${days} dias: ${formatCount(total)} no total.` +
    (peak && peak.clicks > 0
      ? ` Pico de ${formatCount(peak.clicks)} em ${formatDayShort(peak.day)}.`
      : ' Nenhum clique no período.');

  const last30 = geo.points[geo.points.length - 1];

  return (
    <figure className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${geo.width} ${geo.height}`}
        preserveAspectRatio="none"
        className="h-56 w-full"
      >
        {/* Grid + rótulos do eixo Y (recessivos) */}
        {geo.yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={geo.plot.left}
              y1={tick.y}
              x2={geo.plot.right}
              y2={tick.y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={geo.plot.left - 8}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--color-muted-fg)"
            >
              {formatCount(tick.value)}
            </text>
          </g>
        ))}

        {/* Área (wash) + linha (accent) */}
        {geo.areaPath && (
          <path d={geo.areaPath} fill="var(--color-accent)" fillOpacity={0.1} stroke="none" />
        )}
        {geo.linePoints && (
          <polyline
            points={geo.linePoints}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Marcador do último dia (com anel na cor da superfície p/ legibilidade) */}
        {last30 && (
          <circle
            cx={last30.x}
            cy={last30.y}
            r={4}
            fill="var(--color-accent)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        )}

        {/* Rótulos do eixo X (primeiro e último dia) */}
        {first && (
          <text
            x={geo.plot.left}
            y={geo.height - 8}
            textAnchor="start"
            fontSize={11}
            fill="var(--color-muted-fg)"
          >
            {formatDayShort(first.day)}
          </text>
        )}
        {last && (
          <text
            x={geo.plot.right}
            y={geo.height - 8}
            textAnchor="end"
            fontSize={11}
            fill="var(--color-muted-fg)"
          >
            {formatDayShort(last.day)}
          </text>
        )}
      </svg>

      {/* Tabela alternativa (leitores de tela): os mesmos dados diários */}
      <table className="sr-only">
        <caption>Cliques por dia nos últimos {days} dias</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Cliques</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.day}>
              <td>{p.day}</td>
              <td>{formatCount(p.clicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
