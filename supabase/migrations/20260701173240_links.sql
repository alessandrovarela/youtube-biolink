-- Story 3.1 — Schema links (blocos de link do biolink)
-- Fonte: docs/architecture.md § 9.3
-- Depende da baseline (pgcrypto, set_updated_at) — Story 1.4 — e de profiles — Story 2.1.
-- SEM RLS no MVP: autorização é app-layer (RLS deferido para Epic 6).

CREATE TABLE public.links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  url text NOT NULL CHECK (url ~ '^https?://'),
  position int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_links_profile_position
  ON public.links (profile_id, position);

-- Trigger updated_at (reusa função da baseline)
CREATE TRIGGER links_set_updated_at
  BEFORE UPDATE ON public.links
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
