// Story 5.5 — Estado vazio do dashboard de analytics (nenhum clique ainda).
// Cópia amigável + CTA para compartilhar a página pública. O path real é `/username`
// (o `@` é display-only — ver Story 3.6); exibimos `@username` mas linkamos `/username`.
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export function AnalyticsEmptyState({ username }: { username: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <h2 className="text-lg font-semibold">Nenhum clique ainda</h2>
      <p className="max-w-sm text-sm text-muted-fg">
        Assim que alguém tocar nos seus links, os números aparecem aqui. Compartilhe sua página
        pública para começar a receber visitas.
      </p>
      {username && (
        <Link href={`/${username}`} className="mt-1">
          <Button variant="primary">Ver sua página @{username}</Button>
        </Link>
      )}
    </div>
  );
}
