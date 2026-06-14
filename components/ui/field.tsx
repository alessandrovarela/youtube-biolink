// Campo de formulário mínimo (label + input + erro). Será formalizado no Epic 4.
import type { InputHTMLAttributes } from 'react';

type FieldProps = {
  label: string;
  name: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function Field({ label, name, error, ...rest }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        {...rest}
      />
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
