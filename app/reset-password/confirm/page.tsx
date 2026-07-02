'use client';

// Story 2.x — definir nova senha. Story 4.2 — migrado para os primitivos.
import { useActionState } from 'react';
import { confirmPasswordReset } from '@/lib/actions/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ResetPasswordConfirmPage() {
  const [state, action, pending] = useActionState(confirmPasswordReset, null);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <Card>
        <h1 className="text-2xl font-bold">Definir nova senha</h1>
        <form action={action} className="flex flex-col gap-4">
          <Input
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            error={fieldErrors.password}
          />
          <Input
            label="Confirmar nova senha"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            error={fieldErrors.confirmPassword}
          />
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" loading={pending}>
            Salvar nova senha
          </Button>
        </form>
      </Card>
    </main>
  );
}
