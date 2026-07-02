// Story 2.8 — botão de logout (form action chama a Server Action signOut).
// Story 4.2 — usa o primitivo Button (variant ghost).
import { signOut } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';

export function LogoutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        Sair
      </Button>
    </form>
  );
}
