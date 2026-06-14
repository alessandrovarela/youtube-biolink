'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import type { FormState } from './types';

const MAX_BIO = 160;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

// Story 2.10 — atualização de perfil (authz app-layer: filtro por auth.uid()).
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para continuar' };

  const displayName = str(formData, 'display_name').trim();
  const bio = str(formData, 'bio').trim();
  const avatarUrl = str(formData, 'avatar_url').trim();

  const fieldErrors: Record<string, string> = {};
  if (bio.length > MAX_BIO) fieldErrors.bio = `Máximo ${MAX_BIO} caracteres`;
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    fieldErrors.avatar_url = 'A URL deve começar com http:// ou https://';
  }
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: 'Corrija os campos destacados', fieldErrors };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
    })
    .eq('id', user.id); // authz: só o próprio perfil

  if (error) {
    return { ok: false, error: 'Não foi possível salvar o perfil' };
  }

  revalidatePath('/[username]', 'page');
  return { ok: true };
}
