import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  return <LoginForm confirmed={sp.confirmed === '1'} reset={sp.reset === '1'} />;
}
