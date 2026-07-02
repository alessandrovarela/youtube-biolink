// Story 5.5 — Skeleton de carregamento da rota /dashboard/analytics (AC5).
// Espelha o layout final (cabeçalho + card do gráfico + card da tabela) enquanto
// as agregações (Story 5.4) resolvem no servidor. `animate-pulse` respeita
// prefers-reduced-motion via regra global em globals.css.
import { Card } from '@/components/ui/Card';

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <Bar className="h-8 w-40" />
        <Bar className="h-9 w-56 rounded-pill" />
      </div>

      <Card>
        <Bar className="h-5 w-36" />
        <Bar className="h-56 w-full" />
      </Card>

      <Card>
        <Bar className="h-5 w-40" />
        <div className="flex flex-col gap-3">
          <Bar className="h-6 w-full" />
          <Bar className="h-6 w-full" />
          <Bar className="h-6 w-full" />
        </div>
      </Card>
    </div>
  );
}
