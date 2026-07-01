'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase';
import { validateUsername, normalizeUsername } from '@/lib/validation/username';
import { usernameErrorMessage, isValidEmail } from '@/lib/validation/messages';
import type { FormState } from './types';

const MIN_PASSWORD = 8;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

// ── Story 2.4 — Signup ────────────────────────────────────────────────
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
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
  redirect('/dashboard');
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
  const email = str(formData, 'email').trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: 'E-mail inválido' };

  // Origin da request para montar o link de retorno. Server Actions sempre
  // enviam o header Origin (proteção CSRF do Next); fallback via host.
  const h = await headers();
  const origin =
    h.get('origin') ??
    (h.get('host') ? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}` : '');

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
