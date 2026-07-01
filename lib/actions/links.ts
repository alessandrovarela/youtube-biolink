'use server';

// Story 3.3 — CRUD de links no dashboard.
// Convenção § 5.1: 'use server', getUser(), validação inline (checks TS +
// sanitizeLinkUrl), query filtrada por profile_id = user.id (authz app-layer,
// sem RLS no MVP), retorna ActionResult (nunca lança).
// Catálogo § 5.2: createLink / updateLink / deleteLink / toggleLinkActive.
// [Source: architecture.md § 5.1, § 5.2; lib/validation/url.ts (Story 3.2)]

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import { sanitizeLinkUrl } from '@/lib/validation/url';
import type { Link } from '@/lib/types';
import type { ActionResult } from './types';

const TITLE_MIN = 1;
const TITLE_MAX = 60; // paridade com CHECK char_length(title) BETWEEN 1 AND 60 (Story 3.1)
const MAX_LINKS = 30; // limite por usuário [Source: prd.md Story 3.3 AC5]

const NOT_SIGNED_IN = 'Faça login para continuar';
const URL_INVALID = 'Informe uma URL válida começando com http:// ou https://';

/** Revalida a lista do dashboard e a página pública do usuário. [Source: § 5.2] */
function revalidateLinks(): void {
  revalidatePath('/dashboard/links');
  revalidatePath('/[username]', 'page');
}

/** Valida o título (1–60 chars após trim). Retorna a mensagem de erro ou null. */
function titleError(title: string): string | null {
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return `O título deve ter entre ${TITLE_MIN} e ${TITLE_MAX} caracteres`;
  }
  return null;
}

// ── createLink ────────────────────────────────────────────────────────
export async function createLink(input: { title: string; url: string }): Promise<ActionResult<Link>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const title = (input?.title ?? '').trim();
  const fieldErrors: Record<string, string> = {};

  const tErr = titleError(title);
  if (tErr) fieldErrors.title = tErr;

  const sanitized = sanitizeLinkUrl(input?.url ?? '');
  if (!sanitized.ok) fieldErrors.url = URL_INVALID;

  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: 'Corrija os campos destacados', fieldErrors };
  }

  // Limite de 30 links por usuário — rejeita o 31º.
  const { count, error: countErr } = await supabase
    .from('links')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id);
  if (countErr) return { ok: false, error: 'Não foi possível criar o link. Tente novamente.' };
  if ((count ?? 0) >= MAX_LINKS) {
    return {
      ok: false,
      error: `Você atingiu o limite de ${MAX_LINKS} links. Remova algum antes de adicionar outro.`,
    };
  }

  // position do novo = fim da lista (maior position + 1, ou 0 se vazio).
  const { data: last } = await supabase
    .from('links')
    .select('position')
    .eq('profile_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = last ? (last.position as number) + 1 : 0;

  // sanitized é ok aqui (validação acima) — value é a URL canônica.
  const url = sanitized.ok ? sanitized.value : '';
  const { data, error } = await supabase
    .from('links')
    .insert({ profile_id: user.id, title, url, position })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: 'Não foi possível criar o link. Tente novamente.' };

  revalidateLinks();
  return { ok: true, data: data as Link };
}

// ── updateLink ────────────────────────────────────────────────────────
export async function updateLink(input: {
  id: string;
  title?: string;
  url?: string;
}): Promise<ActionResult<Link>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const id = (input?.id ?? '').trim();
  if (!id) return { ok: false, error: 'Link inválido' };

  const patch: { title?: string; url?: string } = {};
  const fieldErrors: Record<string, string> = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    const tErr = titleError(title);
    if (tErr) fieldErrors.title = tErr;
    else patch.title = title;
  }
  if (input.url !== undefined) {
    const sanitized = sanitizeLinkUrl(input.url);
    if (!sanitized.ok) fieldErrors.url = URL_INVALID;
    else patch.url = sanitized.value;
  }

  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: 'Corrija os campos destacados', fieldErrors };
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'Nada para atualizar' };
  }

  const { data, error } = await supabase
    .from('links')
    .update(patch)
    .eq('id', id)
    .eq('profile_id', user.id) // authz app-layer: só o dono altera
    .select('*')
    .maybeSingle();
  if (error) return { ok: false, error: 'Não foi possível atualizar o link.' };
  if (!data) return { ok: false, error: 'Link não encontrado' };

  revalidateLinks();
  return { ok: true, data: data as Link };
}

// ── deleteLink ────────────────────────────────────────────────────────
export async function deleteLink(input: { id: string }): Promise<ActionResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const id = (input?.id ?? '').trim();
  if (!id) return { ok: false, error: 'Link inválido' };

  const { data, error } = await supabase
    .from('links')
    .delete()
    .eq('id', id)
    .eq('profile_id', user.id) // authz app-layer
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: 'Não foi possível remover o link.' };
  if (!data) return { ok: false, error: 'Link não encontrado' };

  revalidateLinks();
  return { ok: true };
}

// ── toggleLinkActive ──────────────────────────────────────────────────
export async function toggleLinkActive(input: {
  id: string;
  is_active: boolean;
}): Promise<ActionResult<Link>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const id = (input?.id ?? '').trim();
  if (!id) return { ok: false, error: 'Link inválido' };
  if (typeof input.is_active !== 'boolean') return { ok: false, error: 'Estado inválido' };

  const { data, error } = await supabase
    .from('links')
    .update({ is_active: input.is_active })
    .eq('id', id)
    .eq('profile_id', user.id) // authz app-layer
    .select('*')
    .maybeSingle();
  if (error) return { ok: false, error: 'Não foi possível atualizar o link.' };
  if (!data) return { ok: false, error: 'Link não encontrado' };

  revalidateLinks();
  return { ok: true, data: data as Link };
}
