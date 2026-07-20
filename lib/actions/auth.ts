'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase';
import { validateUsername, normalizeUsername } from '@/lib/validation/username';
import { usernameErrorMessage, isValidEmail } from '@/lib/validation/messages';
import { checkRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit';
import { safeNextPath } from '@/lib/validation/next-path';
import type { FormState } from './types';

// Story 6.4 — rate limiting por IP (NFR18/FR21). O throttle é a PRIMEIRA coisa que
// roda em cada action: antes da validação, do round-trip ao banco e do hash de senha
// do GoTrue. É o ponto todo de um limiter — cortar antes do trabalho caro.
//
// A mensagem de estouro é GENÉRICA e idêntica em todos os casos (RATE_LIMIT_MESSAGE):
// não revela o mecanismo e não permite enumerar contas — o atacante não distingue
// "estourei o limite numa conta que existe" de "numa que não existe". [AC12 · R2]
//
// Estouro do próprio limiter → fail-open (ver lib/rate-limit.ts): nunca bloqueia
// ninguém e nunca sobe exceção para a UI.

const MIN_PASSWORD = 8;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

/**
 * Origin da request corrente. Server Actions sempre enviam o header `Origin`
 * (é parte da proteção CSRF do Next); o fallback por `host` cobre proxies que o
 * removem. Usado para (a) montar links de retorno e (b) ancorar a validação de
 * `?next=` — `safeNextPath` compara o origin resolvido contra ESTE valor.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  return (
    h.get('origin') ??
    (h.get('host') ? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}` : '')
  );
}

// ── Story 2.4 — Signup ────────────────────────────────────────────────
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  // 5 cadastros por hora por IP (NFR18).
  if (!(await checkRateLimit('signup'))) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const email = str(formData, 'email').trim().toLowerCase();
  const password = str(formData, 'password');
  const confirmPassword = str(formData, 'confirmPassword');
  const username = normalizeUsername(str(formData, 'username'));

  const fieldErrors: Record<string, string> = {};
  if (!isValidEmail(email)) fieldErrors.email = 'E-mail inválido';
  if (password.length < MIN_PASSWORD) fieldErrors.password = `Mínimo ${MIN_PASSWORD} caracteres`;
  if (password !== confirmPassword) fieldErrors.confirmPassword = 'As senhas não conferem';
  const u = validateUsername(username);
  if (!u.ok) fieldErrors.username = usernameErrorMessage(u.error);
  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Corrija os campos destacados', fieldErrors };

  const supabase = await createServerClient();

  // Checagem de duplicata ANTES do signUp (citext → case-insensitive).
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: 'Corrija os campos destacados', fieldErrors: { username: 'Username já está em uso' } };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) {
    return { ok: false, error: 'Não foi possível criar a conta. Tente novamente.' };
  }

  redirect('/signup/check-email');
}

// ── Story 2.5 — Reenvio de confirmação ────────────────────────────────
export async function resendConfirmation(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = str(formData, 'email').trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: 'E-mail inválido' };

  const supabase = await createServerClient();
  await supabase.auth.resend({ type: 'signup', email });
  // Resposta neutra (não revela se o e-mail existe).
  return { ok: true };
}

// ── Story 2.6 — Login ─────────────────────────────────────────────────
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  // 10 tentativas por 15 min por IP (NFR18) — a barreira contra força bruta de senha.
  if (!(await checkRateLimit('login'))) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const email = str(formData, 'email').trim().toLowerCase();
  const password = str(formData, 'password');
  if (!email || !password) return { ok: false, error: 'Informe e-mail e senha' };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Erro genérico — não diferenciar senha errada de conta não confirmada (segurança).
    return { ok: false, error: 'E-mail ou senha inválidos' };
  }

  revalidatePath('/', 'layout');

  // TD-7 — consumo do `?next=` que o proxy edge produz ao barrar uma rota
  // protegida. Antes, o parâmetro era GERADO e nunca LIDO: quem tentava abrir
  // `/dashboard/links` sem sessão era mandado para `/login?next=/dashboard/links`
  // e, após entrar, caía em `/dashboard` — perdia o destino original.
  //
  // O valor vem de um campo de formulário, ou seja, é INPUT DO USUÁRIO e não pode
  // ser usado cru num redirect (open redirect). Passa por `safeNextPath`, a MESMA
  // função que o `/auth/callback` usa — endurecida no Epic 6 contra `//evil.com`,
  // `/\evil.com`, URLs absolutas e esquemas (`javascript:`), e coberta por testes.
  // Se `next` for ausente, inválido ou externo, o fallback é `/dashboard`.
  const next = safeNextPath(str(formData, 'next'), await requestOrigin());
  redirect(next ?? '/dashboard');
}

// ── Story 2.8 — Logout ────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

// ── Story 2.7 — Reset de senha (request) ──────────────────────────────
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  // 3 pedidos por hora por IP (NFR18) — limita o abuso do disparo de e-mail.
  if (!(await checkRateLimit('reset'))) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const email = str(formData, 'email').trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: 'E-mail inválido' };

  // Origin da request para montar o link de retorno.
  const origin = await requestOrigin();

  const supabase = await createServerClient();
  // O link de recuperação passa pelo /auth/callback (troca o code por sessão de
  // recovery) e de lá segue para /reset-password/confirm (definir nova senha).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password/confirm`,
  });
  // Resposta neutra (não enumerar contas).
  return { ok: true };
}

// ── Story 2.7 — Reset de senha (confirmação) ──────────────────────────
export async function confirmPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = str(formData, 'password');
  const confirmPassword = str(formData, 'confirmPassword');
  const fieldErrors: Record<string, string> = {};
  if (password.length < MIN_PASSWORD) fieldErrors.password = `Mínimo ${MIN_PASSWORD} caracteres`;
  if (password !== confirmPassword) fieldErrors.confirmPassword = 'As senhas não conferem';
  if (Object.keys(fieldErrors).length) return { ok: false, error: 'Corrija os campos destacados', fieldErrors };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: 'Link inválido ou expirado. Solicite um novo.' };
  }

  redirect('/login?reset=1');
}
