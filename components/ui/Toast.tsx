// Story 4.2 — Toast primitivo.
// Derivado de docs/design/system/project/preview/cards-toasts.html.
// Top-right, auto-dismiss 5s, acessível: role="status" (sucesso/info) ou
// role="alert" (erro). Client: usa timer + efeito.
'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/cn';

export type ToastVariant = 'success' | 'error' | 'info';

export type ToastProps = {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss em ms (0 desativa). */
  duration?: number;
  onDismiss?: () => void;
};

const dotClass: Record<ToastVariant, string> = {
  success: 'bg-success',
  error: 'bg-danger',
  info: 'bg-info',
};

export function Toast({ message, variant = 'success', duration = 5000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!onDismiss || duration <= 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div className="fixed right-6 top-6 z-50">
      <div
        role={variant === 'error' ? 'alert' : 'status'}
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm shadow-[var(--shadow-md)]"
      >
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', dotClass[variant])}
          aria-hidden="true"
        />
        <span>{message}</span>
      </div>
    </div>
  );
}
