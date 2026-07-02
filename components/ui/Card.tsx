// Story 4.2 — Card primitivo.
// Derivado de docs/design/system/project/preview/cards-toasts.html.
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-sm)]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
