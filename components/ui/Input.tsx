// Story 4.2 — Input primitivo (label + input + hint/erro).
// Estados de erro derivados de docs/design/system/project/preview/inputs.html.
// Client: usa useId para gerar ids acessíveis (aria-describedby) e forwardRef.
'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Label } from './Label';

export type InputProps = {
  label?: string;
  error?: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export const inputBaseClass =
  'w-full rounded-md border border-border bg-bg px-3 py-2.5 text-sm text-fg transition-colors placeholder:text-muted-fg focus:border-accent';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...rest },
  ref
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputBaseClass, error && 'border-danger', className)}
        {...rest}
      />
      {error ? (
        <span id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="text-xs text-muted-fg">
          {hint}
        </span>
      ) : null}
    </div>
  );
});
