'use client';

import { useActionState } from 'react';
import { requestPasswordReset } from '@/lib/actions/auth';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';

export default function ResetPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Recuperar senha</h1>
      <p className="text-gray-700">Informe seu e-mail e enviaremos um link para redefinir a senha.</p>
      <form action={action} className="flex flex-col gap-4">
        <Field label="E-mail" name="email" type="email" autoComplete="email" required />
        {state?.ok && (
          <p className="text-sm text-green-700">Se o e-mail existir, enviamos o link de recuperação.</p>
        )}
        {state && !state.ok && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <SubmitButton>Enviar link</SubmitButton>
      </form>
      <a href="/login" className="text-sm underline">
        Voltar ao login
      </a>
    </main>
  );
}
