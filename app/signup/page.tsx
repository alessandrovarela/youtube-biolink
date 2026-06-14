'use client';

import { useActionState } from 'react';
import { signUp } from '@/lib/actions/auth';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';

export default function SignupPage() {
  const [state, action] = useActionState(signUp, null);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Criar conta</h1>
      <form action={action} className="flex flex-col gap-4">
        <Field label="E-mail" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
        <Field label="Username" name="username" autoComplete="username" required error={fieldErrors.username} />
        <Field label="Senha" name="password" type="password" autoComplete="new-password" required error={fieldErrors.password} />
        <Field
          label="Confirmar senha"
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
        <SubmitButton>Cadastrar</SubmitButton>
      </form>
      <p className="text-sm text-gray-600">
        Já tem conta?{' '}
        <a href="/login" className="underline">
          Entrar
        </a>
      </p>
    </main>
  );
}
