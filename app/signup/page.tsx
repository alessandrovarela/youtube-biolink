'use client';

// Story 2.x — cadastro. Story 4.2 — migrado para os primitivos.
import { useActionState } from 'react';
import Link from 'next/link';
import { signUp } from '@/lib/actions/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, null);
  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <Card>
        <h1 className="text-2xl font-bold">Criar conta</h1>
        <form action={action} className="flex flex-col gap-4">
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            error={fieldErrors.email}
          />
          <Input
            label="Username"
            name="username"
            autoComplete="username"
            required
            error={fieldErrors.username}
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            error={fieldErrors.password}
          />
          <Input
            label="Confirmar senha"
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
            Cadastrar
          </Button>
        </form>
        <p className="text-sm text-muted-fg">
          Já tem conta?{' '}
          <Link href="/login" className="underline">
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
