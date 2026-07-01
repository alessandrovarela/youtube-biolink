'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { resendConfirmation } from '@/lib/actions/auth';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';

export default function CheckEmailPage() {
  const [state, action] = useActionState(resendConfirmation, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Confirme seu e-mail</h1>
      <p className="text-gray-700">
        Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e
        então faça login.
      </p>

      <details className="text-sm text-gray-600">
        <summary className="cursor-pointer">Não recebeu? Reenviar</summary>
        <form action={action} className="mt-3 flex flex-col gap-3">
          <Field label="E-mail" name="email" type="email" autoComplete="email" required />
          <SubmitButton>Reenviar confirmação</SubmitButton>
          {state?.ok && <p className="text-green-700">Se o e-mail existir, reenviamos o link.</p>}
          {state && !state.ok && <p className="text-red-600">{state.error}</p>}
        </form>
      </details>

      <Link href="/login" className="text-sm underline">
        Ir para o login
      </Link>
    </main>
  );
}
