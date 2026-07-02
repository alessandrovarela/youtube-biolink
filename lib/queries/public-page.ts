// Query da página pública `/[username]` (Story 3.5).
// Leitura pública sem auth: SELECT profile + links ativos ordenados por position.
// [Source: architecture.md § 8.3 — Página Pública; § 9.2/§ 9.3 — profiles/links]
//
// A função recebe o SupabaseClient por parâmetro (injeção) para ser testável de
// forma isolada (unit/integração) sem depender do contexto de request do Next.
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeUsername } from '@/lib/validation/username';

/** Campos públicos do profile exibidos na página. [Source: architecture.md § 9.2] */
export interface PublicProfile {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  /** Tema escolhido pelo dono (Story 4.4). Fallback tratado por resolveTheme(Class). */
  theme: string | null;
}

/** Nome de exibição com fallback para `@username` (Story 3.5/4.4). */
export function displayNameOf(profile: Pick<PublicProfile, 'display_name' | 'username'>): string {
  return profile.display_name?.trim() || `@${profile.username}`;
}

/** Link ativo exibido na página pública. Subconjunto de `Link` (lib/types.ts). */
export interface PublicLink {
  id: string;
  title: string;
  url: string;
  position: number;
}

export interface PublicPageData {
  profile: PublicProfile;
  links: PublicLink[];
}

/**
 * Busca o profile por `username` (case-insensitive via `citext`, Story 2.1) e
 * seus links ativos ordenados por `position`. Retorna `null` quando o profile
 * não existe — o chamador (page) traduz isso em `notFound()` (404).
 *
 * O filtro `is_active = true` na própria query garante que links inativos nunca
 * aparecem publicamente. [Source: architecture.md § 8.3; prd.md Story 3.1 AC3]
 */
export async function fetchPublicPage(
  supabase: SupabaseClient,
  usernameParam: string
): Promise<PublicPageData | null> {
  const username = normalizeUsername(usernameParam);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, theme')
    .eq('username', username)
    .maybeSingle();

  if (error || !profile) return null;

  const { data: links } = await supabase
    .from('links')
    .select('id, title, url, position')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('position', { ascending: true });

  return {
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      theme: profile.theme,
    },
    links: (links ?? []) as PublicLink[],
  };
}
