import { signOut } from '@/lib/actions/auth';

// Story 2.8 — botão de logout (form action chama a Server Action signOut).
export function LogoutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-sm text-gray-600 underline">
        Sair
      </button>
    </form>
  );
}
