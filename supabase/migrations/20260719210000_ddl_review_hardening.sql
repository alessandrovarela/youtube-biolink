-- TD-3 / AC11 da Story 6.3 — revisão de DDL pelo @data-engineer (Dara).
--
-- Fonte: docs/qa/gates/epic-6-final-gate.yml — consolidated_open_debts § TD-3
--        · docs/qa/gates/epic-6-wave-2-gate.yml — issue #5 (AC11 nunca executada)
--        · relatório completo: docs/qa/gates/epic-6-ddl-review.yml
--
-- ⚠️ MIGRATION NOVA, NÃO EDIÇÃO. As 5 migrations do Epic 6 JÁ ESTÃO APLICADAS em
--    development. Reescrever migration aplicada produz drift entre histórico e banco —
--    mesmo precedente das Stories 6.3 e 6.4. Aqui só se ACRESCENTA e se CORRIGE por cima.
--
-- TODAS as afirmações abaixo foram MEDIDAS contra o banco `development` real (Postgres
-- 17.6) com dataset sintético de 500k link_clicks e 200k rate_limit_counters, e o
-- dataset foi removido ao final. Nada aqui é predição.
--
-- Este arquivo é IDEMPOTENTE de ponta a ponta (create index if not exists / create or
-- replace / alter ... set / revoke). Pode reexecutar sem erro.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1) 🔴 ACHADO PRINCIPAL (HIGH) — a query de analytics era O(histórico), não O(janela).
-- ══════════════════════════════════════════════════════════════════════════════
-- A view link_click_daily (20260702120000) agrupa por `(date_trunc('day',
-- lc.clicked_at))::date`. Esse é o defeito, e ele é sutil:
--
--   date_trunc(text, timestamptz) é STABLE, NÃO IMMUTABLE — o resultado depende do
--   TimeZone da sessão. Consequências, ambas ruins:
--
--   (a) NÃO É INDEXÁVEL. Postgres recusa índice sobre expressão STABLE. E como o
--       planner não sabe que date_trunc é monotônica, ele TAMBÉM não consegue
--       reescrever `day >= X` como um range em `clicked_at` — o índice
--       (link_id, clicked_at DESC) da Story 5.1 fica inútil para o recorte temporal.
--   (b) A FRONTEIRA DO DIA DEPENDE DO TimeZone DA SESSÃO, enquanto o lado TS
--       (utcDaysAgo em lib/analytics/clicks.ts) computa dias em UTC. Hoje coincidem
--       porque o PostgREST roda com TimeZone=UTC (verificado), mas é acoplamento
--       implícito e não declarado a uma configuração de servidor.
--
-- MEDIÇÃO (getDailyClicks, janela de 30 dias, 500k cliques, role `authenticated`):
--   ANTES: Index Only Scan + Filter · Rows Removed by Filter: 480.045 ·
--          shared hit=503.272 buffers · Execution Time: 811,9 ms
--   DEPOIS: Index Scan com o recorte de data DENTRO do Index Cond ·
--          Rows Removed by Filter: 0 · shared hit=19.640 buffers ·
--          Execution Time: 42,0 ms
--   → 19,3× mais rápido e 25,6× menos I/O, para devolver as MESMAS 90 linhas.
--
-- POR QUE ISSO ERA GRAVE E NÃO SÓ "LENTO": a role `authenticated` tem
-- statement_timeout = 8s (verificado em pg_roles). Extrapolando a medição, o dashboard
-- de analytics estouraria o timeout por volta de ~5M cliques. E lib/analytics/clicks.ts
-- ENGOLE o erro (`if (error || !data) return series`) — o dashboard não mostraria uma
-- falha, mostraria ZERO CLIQUES. Falha silenciosa que se parece com "ninguém clicou".
--
-- A CORREÇÃO: `(lc.clicked_at at time zone 'UTC')::date` é IMMUTABLE, indexável, e
-- torna a intenção de UTC EXPLÍCITA no schema em vez de herdada do ambiente.
-- Equivalência com a expressão antiga verificada linha a linha sob TimeZone=UTC
-- (0 divergências em 500k linhas) — a mudança é semanticamente NEUTRA hoje.

create index if not exists idx_link_clicks_link_day
  on public.link_clicks (link_id, ((clicked_at at time zone 'UTC')::date));

create or replace view public.link_click_daily as
  select
    lc.link_id,
    (lc.clicked_at at time zone 'UTC')::date as day,
    count(*)::int as clicks
  from public.link_clicks lc
  group by lc.link_id, (lc.clicked_at at time zone 'UTC')::date;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2) 🔴 ARMADILHA DESCOBERTA AO APLICAR O ITEM 1 (HIGH) — e é o achado mais
--    importante desta revisão, porque afeta QUALQUER manutenção futura da view.
-- ══════════════════════════════════════════════════════════════════════════════
-- `CREATE OR REPLACE VIEW` **DESCARTA as reloptions da view**. Ou seja: substituir a
-- view apaga `security_invoker = on`, que é EXATAMENTE o controle que o bloco 3 da
-- migration 20260719180000 introduziu para fechar o vazamento em que qualquer
-- portador da anon key lia a agregação de cliques de TODOS os perfis.
--
-- Isto NÃO é teoria: foi REPRODUZIDO neste banco durante a revisão. Após um
-- `create or replace view`, `pg_class.reloptions` voltou a NULL, e a view voltou a
-- executar com os privilégios do OWNER (postgres, rolbypassrls = true). O estado foi
-- restaurado imediatamente.
--
-- Portanto: toda migration que toque nesta view DEVE reafirmar o security_invoker e os
-- grants logo em seguida, no MESMO arquivo — igual à regra "policies primeiro, ENABLE
-- por último" do epic. É o mesmo tipo de invariante, num objeto diferente.
alter view public.link_click_daily set (security_invoker = on);

revoke all on public.link_click_daily from anon;
revoke insert, update, delete, truncate on public.link_click_daily from authenticated;
grant select on public.link_click_daily to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3) 🟠 ASSIMETRIA DE GRANTS (MEDIUM) — o princípio do epic, aplicado pela metade.
-- ══════════════════════════════════════════════════════════════════════════════
-- O bloco (e) da migration 20260719180000 revogou insert/update/delete/truncate de
-- link_clicks com uma justificativa explícita e correta:
--
--   "se um dia alguém adicionar uma policy permissiva por engano, o privilégio ainda
--    não estará lá"
--
-- Esse raciocínio vale IDENTICAMENTE para `profiles` e `links`, e não tinha sido
-- aplicado a nenhuma das duas. Estado medido em information_schema.role_table_grants
-- antes desta migration:
--
--   profiles → anon:          DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--   profiles → authenticated: DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--   links    → anon:          DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--   links    → authenticated: DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
--
-- (São os grants default do Supabase para o schema public.) Hoje a RLS nega tudo isso,
-- então NÃO há vulnerabilidade ativa — por isso MEDIUM e não HIGH. Mas link_clicks tem
-- DUAS camadas e estas duas tabelas têm UMA. A defesa em profundidade que o epic
-- promete no NFR3 está incompleta exatamente onde moram os dados de usuário.
--
-- O privilégio mínimo real, derivado do código da aplicação (verificado arquivo a
-- arquivo, não presumido):
--   · profiles/anon          → SELECT apenas. Único uso anônimo é a checagem de
--                              username duplicado (lib/actions/auth.ts:67) e a página
--                              pública (lib/queries/public-page.ts:53).
--   · profiles/authenticated → SELECT + UPDATE. lib/actions/profile.ts:37 e :65 fazem
--                              UPDATE; ninguém faz INSERT (é o trigger handle_new_user,
--                              SECURITY DEFINER owner postgres) nem DELETE (é o
--                              ON DELETE CASCADE de auth.users, trigger interno).
--   · links/anon             → SELECT apenas (lib/queries/public-page.ts:61).
--   · links/authenticated    → SELECT + INSERT + UPDATE + DELETE (lib/actions/links.ts).
--
-- TRUNCATE, REFERENCES e TRIGGER não são usados por ninguém em nenhuma das tabelas —
-- são ruído do default do Supabase. TRUNCATE em particular NÃO é filtrado por RLS:
-- é o único verbo aqui que a RLS não conteria se o grant fosse alcançável.

revoke truncate, references, trigger on public.profiles from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from anon;

revoke truncate, references, trigger on public.links from anon, authenticated;
revoke insert, update, delete on public.links from anon;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4) 🟡 search_path das funções SECURITY DEFINER (LOW) — endurecer o já-correto.
-- ══════════════════════════════════════════════════════════════════════════════
-- As 4 funções SECURITY DEFINER do projeto declaram `SET search_path = public`
-- (verificado em pg_proc.proconfig). Isso está CERTO e é melhor que a maioria dos
-- projetos. Mas há uma sutileza de Postgres que o comentário das migrations não captura:
--
--   quando `pg_temp` NÃO é listado explicitamente no search_path, ele é implicitamente
--   pesquisado ANTES de todos os outros schemas para nomes de RELAÇÃO (tabelas, views,
--   sequences). Só é ignorado para funções e operadores.
--
-- Ou seja, `SET search_path = public` NÃO neutraliza o schema temporário do chamador —
-- ele apenas o deixa implícito e em primeiro lugar.
--
-- O QUE SALVA O CÓDIGO HOJE — e é importante ser preciso, porque não é o search_path:
-- TODAS as referências a relação dentro das 4 funções são qualificadas por schema
-- (`public.links`, `public.link_clicks`, `public.rate_limit_counters`, `public.profiles`).
-- Referência qualificada ignora o search_path por completo. Logo NÃO EXISTE hijack
-- explorável hoje — este item é hardening, não correção de vulnerabilidade.
--
-- Listar `pg_temp` POR ÚLTIMO move-o da primeira para a última posição de busca,
-- fechando a brecha estruturalmente em vez de depender da disciplina de sempre
-- qualificar. É a recomendação do próprio manual do Postgres para SECURITY DEFINER.
-- Zero mudança de comportamento (nada aqui resolve por search_path).
--
-- Usa-se ALTER FUNCTION em vez de CREATE OR REPLACE: mexe só no proconfig e não
-- reescreve corpo nenhum — a menor mudança possível que resolve o item.

alter function public.record_link_click(uuid, text)                    set search_path = public, pg_temp;
alter function public.check_rate_limit(text, text, int, int, int)      set search_path = public, pg_temp;
alter function public.check_app_rate_limit(text, text)                 set search_path = public, pg_temp;
alter function public.handle_new_user()                                set search_path = public, pg_temp;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5) O QUE FOI VERIFICADO E ESTÁ CORRETO — registrado para não ser "revisado" de novo.
-- ══════════════════════════════════════════════════════════════════════════════
-- Não há mudança de DDL neste bloco. Ele existe porque uma revisão que só lista defeitos
-- obriga o próximo revisor a refazer o trabalho de confirmar o que já estava certo.
--
-- (a) `(select auth.uid())` — aplicado em TODAS as 6 policies que usam auth.uid()
--     (pg_policies confirma o InitPlan). Avaliado uma vez por query, não por linha.
--     Este é o erro de performance de RLS nº 1 no Supabase e o epic NÃO o cometeu.
--
-- (b) A policy link_clicks_select_own faz EXISTS em `links`, e a preocupação natural é
--     que vire SubPlan correlacionado por linha. MEDIDO: não vira. O planner a resolve
--     como `hashed SubPlan` executado UMA vez (`Seq Scan on links l ... actual rows=3
--     loops=1` sobre 500k linhas de link_clicks). Custo O(1) no tamanho de link_clicks.
--     O índice que sustentaria o EXISTS — idx_links_profile_position (profile_id,
--     position) — existe e tem profile_id como coluna líder; a preocupação de "falta
--     índice em links.profile_id" NÃO se confirma.
--
-- (c) PK de rate_limit_counters `(bucket, subject, window_start)` — a ordem está CERTA.
--     O predicado do limiter é `bucket = ? and subject = ? and window_start > ?`, um
--     prefixo exato da PK. MEDIDO com 200k linhas: `Index Scan using
--     rate_limit_counters_pkey`, Index Cond com as 3 colunas, 4 buffers, 2,7 ms.
--     (Com a tabela pequena o planner prefere idx_rate_limit_window_start; ele migra
--     para a PK sozinho quando o volume justifica. Comportamento correto nos dois casos.)
--
-- (d) Housekeeping NÃO faz seq scan: `Index Scan using idx_rate_limit_window_start`
--     com Index Cond no range de idade. O índice existe exatamente para isso e cumpre.
--
-- (e) Volatilidade: as 3 funções que escrevem são VOLATILE (pg_proc.provolatile = 'v'),
--     que é o correto e o default. Nenhuma função está marcada STABLE ou IMMUTABLE
--     indevidamente — um STABLE aqui permitiria ao planner cachear o resultado do
--     limiter dentro de uma query e furar a contagem.
--
-- (f) Owner das funções SECURITY DEFINER = `postgres`, com rolbypassrls = true
--     (confirmado em pg_roles). É a premissa de que todo o rate limiting depende, e em
--     development ela é FATO observado, não inferência. Em produção continua sendo a
--     predição registrada em PRE-M7 do final gate — esta revisão não a converte em
--     observação e não pretende fazê-lo.
--
-- (g) pg_advisory_xact_lock: o lock é por (bucket, subject) e tem escopo de transação.
--     No caminho do PostgREST cada RPC é sua própria transação, então o lock dura
--     microssegundos. Ele serializa DE PROPÓSITO os cliques de um MESMO link — é o que
--     torna check-and-increment atômico. Não há contenção entre links diferentes nem
--     entre usuários diferentes. Colisão de hash (hashtextextended → bigint) causaria
--     serialização espúria entre duas chaves distintas: probabilidade desprezível e
--     consequência = latência, nunca contagem errada. Desenho correto.
