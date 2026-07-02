// Story 4.2 — Button primitivo do design system.
// Variants/estados derivados de docs/design/system/project/preview/buttons.html.
// Server component por padrão (sem hooks); usável dentro de forms client.
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Exibe spinner e desabilita o botão (ex.: submit pendente). */
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-95 active:scale-[0.98]',
  secondary: 'bg-muted text-fg hover:brightness-95',
  ghost: 'bg-transparent text-fg hover:bg-muted',
  destructive: 'bg-danger text-white hover:brightness-95',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-[13px] gap-1.5 rounded-md px-3 py-1.5',
  md: 'text-sm gap-2 rounded-md px-4 py-2.5',
  lg: 'text-[15px] gap-2 rounded-md px-5 py-3',
};

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 0 1 8-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  // `type` explícito evita submits acidentais — consumidores em forms passam "submit".
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center border-0 font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
