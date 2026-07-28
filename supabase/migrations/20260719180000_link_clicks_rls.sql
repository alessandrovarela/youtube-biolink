-- Story 6.3 — RLS em public.link_clicks + hardening da view link_click_daily +
--              RPC record_link_click (rota única de escrita do tracking).
--
-- Fonte: PRD Story 5.1 AC3 (L702) e Story 5.2 AC3 (L716) — policies nominadas e
--        deferidas para o Epic 6 · PRD NFR3 (defense-in-depth) · NFR19 (sem IP raw)
--        · docs/architecture/security-epic-6.md (ADR-001 § 2, decisão RATIFICADA)
--        · docs/architecture/epic-6-data-access-inventory.md § 4/R3, § 4/R4, § 5.3, § 5.4
--        · docs/qa/gates/epic-6-wave-1-gate.yml — concern #1 (view sem security_invoker)
--        · QA gate Epic 5 — concern MEDIUM (INSERT anônimo em link_clicks).
--
-- ORDEM OBRIGATÓRIA (decisão #5a do epic): policies, RPC, grants e o hardening da view
-- vivem no MESMO arquivo que o ENABLE ROW LEVEL SECURITY. A migration roda em transação,
-- então não existe janela em que a RLS esteja ligada sem as regras que a tornam usável.
--
-- DEFENSE-IN-DEPTH (NFR3): a autorização application-layer NÃO é removida.
-- lib/analytics/clicks.ts continua resolvendo os link_ids do profile antes de ler a
-- agregação, e a validação de is_active continua existindo (agora no banco, dentro da
-- RPC, atômica com o INSERT). A RLS SOMA uma barreira — não substitui nada.
--
-- ┌──────────────────────────────────────────────────────────────────────────────┐
-- │ POR QUE NÃO EXISTE POLICY DE INSERT (a decisão central desta migration)       │
-- └──────────────────────────────────────────────────────────────────────────────┘
-- Hoje lib/actions/track-click.ts insere em link_clicks com a ANON KEY. Como a anon key
-- é pública por definição (vai no bundle do browser), qualquer pessoa pode hoje fazer
-- POST /rest/v1/link_clicks com um link_id arbitrário — e também UPDATE e DELETE. O
-- caráter "append-only" da tabela é ficção. Esse é o concern MEDIUM do gate do Epic 5.
--
-- O inventário PRE-2 (§ 5.3) propôs uma policy `link_clicks_insert_active`
-- (`with check (exists (select 1 from links where id = link_id and is_active))`).
-- Ela foi DESCARTADA por arbitragem do @pm: seria mais frouxa que o desenho do ADR —
-- permitiria a qualquer detentor da anon key inserir cliques em qualquer link ativo,
-- que é exatamente o abuso que queremos fechar.
--
-- Com RLS habilitada, AUSÊNCIA de policy = NEGAÇÃO. Logo: sem policy de INSERT, UPDATE
-- ou DELETE, a tabela vira append-only DE VERDADE no banco, e a ÚNICA porta de escrita
-- passa a ser a função record_link_click() abaixo (SECURITY DEFINER), que valida
-- is_active no próprio banco. [ADR-001 § 2 · arbitragem @pm]
--
-- DÉBITO QUE ESTA MIGRATION NÃO FECHA: click inflation. A RLS bloqueia link_ids
-- inválidos e inativos, mas não impede POSTs repetidos à RPC contra um link ATIVO
-- legítimo. Mitigação = rate limiting, Story 6.4. [ADR-001 § 3]
--
-- ON DELETE CASCADE segue funcionando: ações de integridade referencial são executadas
-- por triggers internos, que não são filtrados por RLS nem por GRANTs do chamador.
-- Apagar um link com cliques continua OK (lib/actions/links.ts:199). [inventory § 5.3]
--
-- POR QUE `(select auth.uid())` E NÃO `auth.uid()`: força o planner a avaliar a função
-- uma única vez (InitPlan) em vez de por linha. Mesmo padrão das Stories 6.1 e 6.2.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1) Policy de leitura: só o dono do link enxerga os cliques dele.
-- ══════════════════════════════════════════════════════════════════════════════
-- link_clicks NÃO tem coluna profile_id; o único caminho até o dono é o join lógico
-- via links. O EXISTS é avaliado sob a RLS do chamador (links_select_own /
-- links_select_public_active da Story 6.2) — daí a dependência declarada da 6.2.
--
-- Índice: o predicado casa (link_id) e depois a PK de links; o índice existente
-- (link_id, clicked_at desc) da Story 5.1 já cobre o lado de link_clicks.
create policy link_clicks_select_own on public.link_clicks
  for select to authenticated
  using (
    exists (
      select 1
      from public.links l
      where l.id = link_clicks.link_id
        and l.profile_id = (select auth.uid())
    )
  );

-- SEM policy de INSERT / UPDATE / DELETE — ver o bloco de comentário acima.
-- anon não tem NENHUMA policy: não lê e não escreve link_clicks por via direta.

alter table public.link_clicks enable row level security;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2) Rota ÚNICA de escrita: eleva privilégio para UMA operação, auditável.
-- ══════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER executa com os privilégios do OWNER (postgres, que tem BYPASSRLS),
-- então o INSERT passa por cima da negação da RLS — de forma estreita e controlada.
--
-- Toda função SECURITY DEFINER é superfície de ataque. Os três controles obrigatórios
-- (ADR-001 § 4) estão aplicados:
--   a) `set search_path = public` — impede search_path hijack (um schema temporário do
--      chamador contendo uma tabela `links` falsa sequestraria a validação). Mesmo
--      padrão de handle_new_user() (migration 20260614220038).
--   b) `revoke all ... from public` — remove o EXECUTE implícito concedido a PUBLIC.
--   c) `grant execute ... to anon, authenticated` — allowlist explícita e mínima.
--
-- A alternativa (b) do ADR — createAdminClient com SUPABASE_SERVICE_ROLE_KEY no runtime
-- do app — foi REFUTADA: resolveria um problema de RLS desligando RLS e colocaria uma
-- chave de bypass total do banco no processo do Next.js. Aqui o privilégio elevado
-- cobre 1 operação e não sai do banco.
--
-- Validação de is_active AUTORITATIVA e ATÔMICA com o INSERT: elimina a janela TOCTOU
-- que o SELECT-depois-INSERT do app tinha (o link podia ser desativado entre as duas
-- queries). Também reduz 2 round-trips para 1.
--
-- NFR19: a função não recebe nem persiste IP. O user-agent chega truncado do app e é
-- truncado DE NOVO aqui (left(...,120)), em paridade com o CHECK do banco (Story 5.1) —
-- defesa em camadas, e garante que um chamador direto da RPC não estoure o CHECK.
create or replace function public.record_link_click(
  p_link_id          uuid,
  p_user_agent_short text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
begin
  select l.is_active into v_active
  from public.links l
  where l.id = p_link_id;

  -- Link inexistente (v_active is null) ou inativo → no-op silencioso.
  if v_active is not true then
    return false;
  end if;

  insert into public.link_clicks (link_id, user_agent_short)
  values (p_link_id, left(p_user_agent_short, 120));

  return true;
end;
$$;

revoke all on function public.record_link_click(uuid, text) from public;
grant execute on function public.record_link_click(uuid, text) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3) Hardening da view link_click_daily — 🔴 VAZAMENTO ATIVO EM PRODUÇÃO HOJE.
-- ══════════════════════════════════════════════════════════════════════════════
-- Achado do PRE-2, confirmado no catálogo pelo gate da Wave 1 (concern #1).
--
-- A view foi criada (20260702120000_link_click_daily.sql) SEM `security_invoker`
-- (default = false) e COM `grant select ... to anon`. Em Postgres, uma view sem
-- security_invoker executa com os privilégios do OWNER — aqui `postgres`, que tem
-- rolbypassrls = true no Supabase. Consequência: habilitar RLS em link_clicks (bloco 1)
-- NÃO fecharia nada — a view continuaria furando por cima, e qualquer pessoa com a anon
-- key leria, sem sessão, a agregação de cliques de TODOS os links de TODOS os perfis
-- via GET /rest/v1/link_click_daily.
--
-- CORREÇÃO DO CABEÇALHO DA MIGRATION DA VIEW (concern #4 do gate da Wave 1): aquele
-- arquivo afirma que "a leitura de analytics usa a anon key". É FALSO —
-- app/dashboard/analytics/page.tsx:19 usa createServerClient() com cookie de sessão,
-- ou seja, role `authenticated`. É justamente por isso que os grants abaixo dimensionam
-- o acesso para `authenticated` e revogam `anon` sem quebrar o dashboard.

-- (a) A view passa a executar com os privilégios do CHAMADOR → respeita
--     link_clicks_select_own. Efeito colateral desejado e registrado: o count(*) da
--     view passa a ser calculado sobre as linhas VISÍVEIS ao chamador, isto é, a
--     semântica da agregação muda POR ROLE (cada dono conta os próprios cliques).
--     O filtro .in('link_id', linkIds) de lib/analytics/clicks.ts deixa de ser a única
--     barreira e vira defesa em profundidade. [inventory § 4/R3]
alter view public.link_click_daily set (security_invoker = on);

-- (b) Nenhum caminho anônimo lê a view. `revoke all` e não só `revoke select`: o
--     default do Supabase concede TAMBÉM insert/update/delete/truncate a anon nesta
--     view (confirmado pelo gate da Wave 1). Views agregadas não são atualizáveis, mas
--     o grant não deveria existir de qualquer forma — menor privilégio.
revoke all on public.link_click_daily from anon;

-- (c) O dono continua lendo a view; escrita nunca fez sentido aqui.
revoke insert, update, delete, truncate on public.link_click_daily from authenticated;
grant select on public.link_click_daily to authenticated;

-- (d) CRÍTICO: com security_invoker = on, o chamador precisa de privilégio na TABELA
--     BASE, não só na view. Sem esta linha o dashboard de analytics passa a receber
--     `permission denied for table link_clicks` — o erro mais provável de um rollout
--     apressado desta story. [inventory § 4/R3 correção 3, § 6 risco 7]
grant select on public.link_clicks to authenticated;

-- (e) Simetria com o bloco 1: a escrita direta em link_clicks já é negada pela RLS
--     (ausência de policy). Revogar o GRANT é a segunda camada — se um dia alguém
--     adicionar uma policy permissiva por engano, o privilégio ainda não estará lá.
--     Não afeta a RPC (SECURITY DEFINER roda como o owner) nem o ON DELETE CASCADE
--     (executado por trigger interno, fora do controle de privilégios do chamador).
revoke insert, update, delete, truncate on public.link_clicks from anon, authenticated;

-- Recarrega o schema cache do PostgREST: expõe a RPC e aplica os novos grants
-- imediatamente, sem esperar o reload periódico.
notify pgrst, 'reload schema';
