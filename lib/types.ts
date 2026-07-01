// Tipos de domínio compartilhados.
// Fonte canônica: docs/architecture.md § 4 (Data Models).

/** Bloco de link do biolink. [Source: architecture.md § 4.2] */
export interface Link {
  id: string;
  profile_id: string; // FK profiles.id
  title: string; // 1-60 chars
  url: string; // http(s) apenas
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}
