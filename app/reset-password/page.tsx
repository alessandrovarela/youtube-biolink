'use client';

// Story 2.x — solicitar reset de senha. Story 4.2 — migrado para os primitivos.
import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/actions/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <Card>
        <h1 className="text-2xl font-bold">Recuperar senha</h1>
        <p className="text-muted-fg">
          Informe seu e-mail e enviaremos um link para redefinir a senha.
        </p>
        <form action={action} className="flex flex-col gap-4">
          <Input label="E-mail" name="email" type="email" autoComplete="email" required />
          {state?.ok && (
            <p className="text-sm text-success">
              Se o e-mail existir, enviamos o link de recuperação.
            </p>
          )}
          {state && !state.ok && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <Button type="submit" loading={pending}>
            Enviar link
          </Button>
        </form>
        <Link href="/login" className="text-sm underline">
          Voltar ao login
        </Link>
      </Card>
    </main>
  );
}
