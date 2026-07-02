'use client';

// Story 2.x — confirmação de e-mail. Story 4.2 — migrado para os primitivos.
import { useActionState } from 'react';
import Link from 'next/link';
import { resendConfirmation } from '@/lib/actions/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function CheckEmailPage() {
  const [state, action, pending] = useActionState(resendConfirmation, null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <Card>
        <h1 className="text-2xl font-bold">Confirme seu e-mail</h1>
        <p className="text-muted-fg">
          Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e
          então faça login.
        </p>

        <details className="text-sm text-muted-fg">
          <summary className="cursor-pointer">Não recebeu? Reenviar</summary>
          <form action={action} className="mt-3 flex flex-col gap-3">
            <Input label="E-mail" name="email" type="email" autoComplete="email" required />
            <Button type="submit" loading={pending}>
              Reenviar confirmação
            </Button>
            {state?.ok && <p className="text-success">Se o e-mail existir, reenviamos o link.</p>}
            {state && !state.ok && <p className="text-danger">{state.error}</p>}
          </form>
        </details>

        <Link href="/login" className="text-sm underline">
          Ir para o login
        </Link>
      </Card>
    </main>
  );
}
