'use client';

import { useActionState } from 'react';
import { signIn } from '@/lib/actions/auth';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';

export function LoginForm({ confirmed, reset }: { confirmed: boolean; reset: boolean }) {
  const [state, action] = useActionState(signIn, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Entrar</h1>
      {confirmed && <p className="text-sm text-green-700">E-mail confirmado! Faça login.</p>}
      {reset && <p className="text-sm text-green-700">Senha redefinida! Faça login.</p>}
      <form action={action} className="flex flex-col gap-4">
        <Field label="E-mail" name="email" type="email" autoComplete="email" required />
        <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
        {state && !state.ok && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <SubmitButton>Entrar</SubmitButton>
      </form>
      <div className="flex justify-between text-sm text-gray-600">
        <a href="/reset-password" className="underline">
          Esqueci minha senha
        </a>
        <a href="/signup" className="underline">
          Criar conta
        </a>
      </div>
    </main>
  );
}
