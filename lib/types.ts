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

/** Registro append-only de clique em um link (analytics). [Source: ER.md — Epic 5, Story 5.1] */
export interface LinkClick {
  id: string;
  link_id: string; // FK links.id (ON DELETE CASCADE)
  clicked_at: string;
  user_agent_short: string | null; // UA truncado <= 120 chars
  user_agent_hash: string | null; // opcional, para dedup futura
}
