// Story 3.5 — Página de erro 404 custom (AC5).
// Renderizada por `notFound()` de app/[username]/page.tsx quando o username
// não corresponde a nenhum profile.
import Link from 'next/link';

export default function UserNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold text-neutral-300">404</p>
      <h1 className="text-2xl font-bold">Perfil não encontrado</h1>
      <p className="text-neutral-600">
        Não encontramos nenhum usuário com esse nome. Verifique o endereço e tente novamente.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg border border-neutral-200 px-4 py-2 font-medium transition-colors hover:bg-neutral-50"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
