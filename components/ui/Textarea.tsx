// Story 4.2 — Textarea primitivo (label + textarea + hint/erro).
// Mesmos padrões de acessibilidade do Input (aria-invalid / aria-describedby).
'use client';

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Label } from './Label';

export type TextareaProps = {
  label?: string;
  error?: string;
  hint?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className, ...rest },
  ref
) {
  const reactId = useId();
  const textareaId = id ?? reactId;
  const hintId = `${textareaId}-hint`;
  const errorId = `${textareaId}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={textareaId}>{label}</Label>}
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-md border border-border bg-bg px-3 py-2.5 text-sm text-fg transition-colors placeholder:text-muted-fg focus:border-accent',
          error && 'border-danger',
          className
        )}
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
