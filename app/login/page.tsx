import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; reset?: string; next?: string }>;
}) {
  const sp = await searchParams;
  // `next` é repassado CRU para o form (vira um <input type="hidden">). A validação
  // NÃO acontece aqui de propósito: quem valida é a Server Action, no momento do
  // redirect, com `safeNextPath`. Validar em dois lugares criaria duas regras que
  // podem divergir; validar só na borda de saída garante que o valor efetivamente
  // usado no redirect é exatamente o valor que foi checado. [TD-7]
  return <LoginForm confirmed={sp.confirmed === '1'} reset={sp.reset === '1'} next={sp.next} />;
}
