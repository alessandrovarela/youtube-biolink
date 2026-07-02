'use client';

// Story 2.x — login. Story 4.2 — migrado para os primitivos (Card/Input/Button).
import { useActionState } from 'react';
import Link from 'next/link';
import { signIn } from '@/lib/actions/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function LoginForm({ confirmed, reset }: { confirmed: boolean; reset: boolean }) {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <Card>
        <h1 className="text-2xl font-bold">Entrar</h1>
        {confirmed && <p className="text-sm text-success">E-mail confirmado! Faça login.</p>}
        {reset && <p className="text-sm text-success">Senha redefinida! Faça login.</p>}
        <form action={action} className="flex flex-col gap-4">
          <Input label="E-mail" name="email" type="email" autoComplete="email" required />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {state && !state.ok && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <Button type="submit" loading={pending}>
            Entrar
          </Button>
        </form>
        <div className="flex justify-between text-sm text-muted-fg">
          <Link href="/reset-password" className="underline">
            Esqueci minha senha
          </Link>
          <Link href="/signup" className="underline">
            Criar conta
          </Link>
        </div>
      </Card>
    </main>
  );
}
