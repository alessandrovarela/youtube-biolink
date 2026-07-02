-- Story 5.4 — View de agregação de cliques por link e por dia (analytics, Epic 5).
-- Fonte: docs/prd.md § 6 — Epic 5, Story 5.4 (AC1); EPIC-5-EXECUTION.yaml (decisão #4).
-- Depende de link_clicks — Story 5.1.
--
-- DECISÃO: view REGULAR (não materializada). Uma materialized view exigiria
-- estratégia de REFRESH (trigger/cron) e traria dados potencialmente stale; o
-- benchmark da Story 5.4 (10k cliques) fica bem abaixo do alvo de <100ms com a
-- view regular sobre o índice (link_id, clicked_at desc) da Story 5.1. Só
-- materializar se um volume futuro exigir — documentado na story.
--
-- SEM RLS no MVP (igual a link_clicks/links): a autorização é application-layer.
-- Os helpers em lib/analytics/clicks.ts restringem a leitura aos link_ids do
-- profile dono (equivalente a links.profile_id = auth.uid()); RLS é Story 6.3.
--
-- Idempotente: CREATE OR REPLACE VIEW + GRANT podem reexecutar sem erro.

create or replace view public.link_click_daily as
  select
    lc.link_id,
    (date_trunc('day', lc.clicked_at))::date as day,
    count(*)::int as clicks
  from public.link_clicks lc
  group by lc.link_id, (date_trunc('day', lc.clicked_at))::date;

-- A leitura de analytics usa a anon key (mesmo client stateless das demais
-- leituras do MVP). authenticated incluído para o futuro (Epic 6).
grant select on public.link_click_daily to anon, authenticated;

-- Recarrega o schema cache do PostgREST para expor a view imediatamente.
notify pgrst, 'reload schema';
