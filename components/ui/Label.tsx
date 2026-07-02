// Story 4.2 — Label primitivo. Associável via htmlFor.
import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, children, ...rest }: LabelProps) {
  return (
    <label className={cn('text-sm font-medium text-fg', className)} {...rest}>
      {children}
    </label>
  );
}
