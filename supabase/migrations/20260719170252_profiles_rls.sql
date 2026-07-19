-- Story 6.1 — RLS policies em public.profiles
-- Origem: Story 2.2 (removida do Epic 2 na reconciliação v1.1 do PRD) → migrada para o Epic 6.
-- Fonte: docs/architecture/epic-6-data-access-inventory.md § 5.1 · PRD NFR3
--
-- DEFENSE-IN-DEPTH (NFR3): a autorização application-layer (`.eq('id', user.id)` em
-- lib/actions/profile.ts e nas queries do dashboard) NÃO é removida. A RLS SOMA uma
-- segunda barreira no banco — ela não substitui nada.
--
-- ORDEM OBRIGATÓRIA: policies primeiro, ENABLE ROW LEVEL SECURITY por último e no MESMO
-- arquivo. Habilitar RLS sem policy nega tudo (lockout). A migration roda em transação,
-- então não existe janela intermediária.
--
-- POR QUE `USING (true)` NO SELECT (e não `auth.uid()`):
--   Todas as colunas de profiles JÁ são públicas hoje — a página pública /[username] lê 5
--   delas com a anon key (ISR, sempre role `anon`). Além disso, a checagem de username
--   duplicado do signup (lib/actions/auth.ts:37) roda como role `anon`: `createServerClient()`
--   só vira `authenticated` se houver cookie de sessão, e no signup não há.
--   Uma policy de SELECT baseada em `auth.uid()` faria `auth.uid()` retornar NULL →
--   predicado falsy → a checagem sempre diria "username livre" e o cadastro falharia
--   depois no UNIQUE com erro genérico. Falha SILENCIOSA. A RLS aqui protege ESCRITA.
--
-- POR QUE `(select auth.uid())` E NÃO `auth.uid()`:
--   Força o planner a avaliar a função uma única vez (InitPlan) em vez de por linha.
--   Em profiles o ganho é marginal, mas mantém o padrão usado em 6.2/6.3.
--
-- POR QUE NÃO HÁ POLICY DE INSERT NEM DE DELETE (com RLS ligada, ausência = negação):
--   INSERT: o único caminho é o trigger handle_new_user(), SECURITY DEFINER com owner
--           `postgres` (que tem BYPASSRLS no Supabase) → roda fora do contexto de RLS.
--           Verificado em development antes desta migration:
--           `select proowner::regrole from pg_proc where proname = 'handle_new_user';`
--           → postgres (prosecdef = true).
--   DELETE: só ocorre via ON DELETE CASCADE de auth.users — ação de integridade
--           referencial, executada por trigger interno e não filtrada por RLS.

-- Leitura pública: perfis são dados públicos por design (FR13/FR14) e a leitura anônima é
-- requisito do signup e da página pública ISR.
create policy profiles_select_public on public.profiles
  for select to anon, authenticated
  using (true);

-- Escrita: cada usuário só atualiza o próprio perfil.
-- O WITH CHECK impede reatribuir `id` para outro usuário (linha resultante também é checada).
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter table public.profiles enable row level security;

notify pgrst, 'reload schema';
