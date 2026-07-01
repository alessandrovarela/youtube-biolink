import Link from 'next/link';

export default function ConfirmFailedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Link inválido ou expirado</h1>
      <p className="text-gray-700">
        Não foi possível confirmar seu e-mail. O link pode ter expirado ou já ter sido usado.
      </p>
      <Link href="/signup/check-email" className="underline">
        Reenviar e-mail de confirmação
      </Link>
      <Link href="/login" className="text-sm underline">
        Ir para o login
      </Link>
    </main>
  );
}
