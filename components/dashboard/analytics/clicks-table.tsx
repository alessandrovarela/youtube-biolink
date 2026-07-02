// Story 5.5 — Tabela de cliques por link (total acumulado + recortes 7d/30d).
// Server component puro. Acessibilidade: <table> com <caption>, <th scope>.
// Inclui links com 0 cliques (semântica garantida por getClicksByLink — Story 5.4).
import type { LinkClickTotals } from '@/lib/analytics/clicks';
import { formatCount } from '@/lib/analytics/chart';

export function ClicksTable({ rows }: { rows: LinkClickTotals[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Cliques por link: total, últimos 7 dias e últimos 30 dias
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-fg">
            <th scope="col" className="py-2 pr-4 font-medium">
              Link
            </th>
            <th scope="col" className="py-2 px-4 text-right font-medium tabular-nums">
              Total
            </th>
            <th scope="col" className="py-2 px-4 text-right font-medium tabular-nums">
              7 dias
            </th>
            <th scope="col" className="py-2 pl-4 text-right font-medium tabular-nums">
              30 dias
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.link_id} className="border-b border-border last:border-0">
              <th scope="row" className="max-w-[240px] truncate py-2.5 pr-4 font-normal">
                {row.title}
              </th>
              <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                {formatCount(row.total)}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-muted-fg">
                {formatCount(row.last7)}
              </td>
              <td className="py-2.5 pl-4 text-right tabular-nums text-muted-fg">
                {formatCount(row.last30)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
