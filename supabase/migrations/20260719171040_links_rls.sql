-- Story 6.2 — RLS policies em public.links
-- Fonte: PRD Story 3.1 AC3 (L529, policies nominadas e deferidas para o Epic 6)
--        · docs/architecture/epic-6-data-access-inventory.md § 5.2 · PRD NFR3
--
-- DEFENSE-IN-DEPTH (NFR3): a autorização application-layer (`.eq('profile_id', user.id)`
-- em lib/actions/links.ts, app/dashboard/links/page.tsx e lib/analytics/clicks.ts, e o
-- `.eq('is_active', true)` de lib/queries/public-page.ts) NÃO é removida. A RLS SOMA uma
-- segunda barreira no banco — ela não substitui nada.
--
-- ORDEM OBRIGATÓRIA: policies primeiro, ENABLE ROW LEVEL SECURITY por último e no MESMO
-- arquivo. Habilitar RLS sem policy nega tudo (lockout). A migration roda em transação,
-- então não existe janela intermediária.
--
-- NOMENCLATURA: a policy de leitura pública chama-se `links_select_public_active` —
--   nome contratado no PRD Story 3.1 AC3 (L529). O inventário PRE-2 (§ 5.2) a chama de
--   `links_select_public`; são o mesmo objeto. Prevalece o nome do PRD (rastreabilidade
--   ao contrato, Artigo IV). Decisão do @pm registrada na Story 6.2.
--
-- POR QUE DUAS POLICIES DE SELECT (a armadilha central desta story):
--   O dashboard lista os links do dono SEM filtro de `is_active`
--   (app/dashboard/links/page.tsx:18 e lib/analytics/clicks.ts:59) — é assim que o
--   toggle de ativar/desativar funciona: o link desativado continua na lista, apenas
--   não aparece na página pública.
--   Uma policy ÚNICA `USING (is_active = true)` esconderia os links inativos DO PRÓPRIO
--   DONO → desativar viraria "o link sumiu".
--   Policies PERMISSIVE (o default) combinam por OR: a linha é visível se QUALQUER uma
--   permitir. Resultado:
--     · `anon`          → só links ativos (de qualquer perfil).
--     · `authenticated` → TODOS os próprios (ativos e inativos) MAIS os ativos de
--                         terceiros — intencional: um usuário logado que abre a página
--                         pública de outro precisa enxergá-la. Não vaza nada, porque as
--                         queries do dashboard já filtram por profile_id na aplicação.
--
-- POR QUE `WITH CHECK` NO UPDATE:
--   O USING decide quais linhas podem ser alteradas; o WITH CHECK valida a linha
--   RESULTANTE. Sem ele, o dono poderia "doar" um link a outro perfil trocando
--   `profile_id` — a linha de origem casaria o USING e a de destino não seria checada.
--
-- MUTATIONS COM RETURNING: lib/actions/links.ts faz `.select(...)` após UPDATE (:131,
--   :227) e DELETE (:198). O RETURNING exige que a linha satisfaça também uma policy de
--   SELECT — coberta por `links_select_own`, inclusive quando o link acabou de ser
--   desativado (`is_active = false`).
--
-- POR QUE `(select auth.uid())` E NÃO `auth.uid()`:
--   Força o planner a avaliar a função uma única vez (InitPlan) em vez de por linha.
--   Mesmo padrão da Story 6.1.
--
-- PERFORMANCE: o índice existente `(profile_id, position)` cobre o predicado de
--   `links_select_own` e continua servindo a query pública (profile_id + is_active).
--   Índice parcial `... WHERE is_active` só se o EXPLAIN degradar — fora de escopo.

-- Leitura pública: qualquer visitante enxerga links ATIVOS (página pública ISR + tracking).
create policy links_select_public_active on public.links
  for select to anon, authenticated
  using (is_active = true);

-- Leitura do dono: TODOS os próprios links, inclusive is_active = false (dashboard,
-- analytics e o RETURNING do toggle). PERMISSIVE → combina com a de cima via OR.
create policy links_select_own on public.links
  for select to authenticated
  using (profile_id = (select auth.uid()));

-- Escrita: cada usuário só cria/altera/remove links no próprio perfil.
create policy links_insert_own on public.links
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy links_update_own on public.links
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy links_delete_own on public.links
  for delete to authenticated
  using (profile_id = (select auth.uid()));

alter table public.links enable row level security;

notify pgrst, 'reload schema';
