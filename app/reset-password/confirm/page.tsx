'use client';

import { useActionState } from 'react';
import { confirmPasswordReset } from '@/lib/actions/auth';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';

export default function ResetPasswordConfirmPage() {
  const [state, action] = useActionState(confirmPasswordReset, null);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Definir nova senha</h1>
      <form action={action} className="flex flex-col gap-4">
        <Field
          label="Nova senha"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={fieldErrors.password}
        />
        <Field
          label="Confirmar nova senha"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={fieldErrors.confirmPassword}
        />
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <SubmitButton>Salvar nova senha</SubmitButton>
      </form>
    </main>
  );
}
