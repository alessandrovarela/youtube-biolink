-- Story 5.1 — Schema link_clicks (analytics de cliques, append-only)
-- Fonte: docs/architecture/ER.md (forward-looking Epic 5) + PRD Epic 5.
-- Depende da baseline (pgcrypto → gen_random_uuid()) — Story 1.4 — e de links — Story 3.1.
--
-- Tabela append-only: um registro por clique. Sem IP raw nem user agent completo
-- (privacidade). `user_agent_short` é o UA truncado (<=120 chars) e `user_agent_hash`
-- é opcional para dedup futura — ambos preenchidos pela Server Action da Story 5.2.
--
-- SEM RLS no MVP: autorização é application-layer (Server Actions filtram por
-- auth.uid() via join links → profiles). RLS + policies desta tabela são a
-- Story 6.3 (Epic 6). O CHECK de user_agent_short é última linha de defesa.

CREATE TABLE public.link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  user_agent_short text CHECK (user_agent_short IS NULL OR char_length(user_agent_short) <= 120),
  user_agent_hash text
);

-- Índice para agregações/leituras de analytics por link, ordenadas por recência.
CREATE INDEX idx_link_clicks_link_clicked_at
  ON public.link_clicks (link_id, clicked_at DESC);
