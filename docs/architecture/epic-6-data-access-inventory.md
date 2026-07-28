# Epic 6 — Inventário de Acesso a Dados (PRE-2, pré-RLS)

> **Objetivo:** mapear TODA leitura/escrita em `profiles`, `links`, `link_clicks` e na view
> `link_click_daily` antes de habilitar RLS (Story 6.3), para derivar policies que não
> quebrem produção.
>
> **Estado atual (MVP, Epics 1–5):** RLS **desabilitada** nas 3 tabelas. A autorização é
> **application-layer** — cada query carrega o filtro de ownership no `.eq()`.
> Não há `service_role` na aplicação (só em testes).
>
> Branch: `feature/epic-6-security` · Autor: @data-engineer (Dara)

---

## 1. Clientes Supabase

Todos definidos em `lib/supabase.ts`. **Todos usam a `ANON_KEY`** — não existe admin client
na aplicação (`architecture.md § 2.2`).

| Client | Arquivo:linha | Transporte | Role Postgres efetiva | Uso |
|---|---|---|---|---|
| `createServerClient()` | `lib/supabase.ts:18` | `@supabase/ssr` + cookies (`next/headers`) | `authenticated` **quando há sessão**; `anon` **quando não há** | Server Components e Server Actions do dashboard/auth |
| `createPublicClient()` | `lib/supabase.ts:49` | `supabase-js` stateless, `persistSession: false` | **sempre `anon`** | Página pública `/[username]` (ISR) e `trackLinkClick` |
| `createBrowserClient()` | `lib/supabase.ts:39` | `@supabase/ssr` browser | `anon` / `authenticated` | **Não usado** para dados no MVP |
| `createBrowserClient` (inline) | `app/health/route.ts:11` | anon | `anon` | Só `auth.getSession()` — não toca tabelas |

### Ponto crítico sobre `createServerClient()`

A anon key só vira role `authenticated` se o cookie de sessão existir. **Há um caminho em que
`createServerClient()` roda como `anon` e toca `profiles`:** a checagem de username duplicado
no signup (`lib/actions/auth.ts:37`), executada por um visitante **sem sessão**.
→ Qualquer policy de `profiles` que exija `auth.uid()` para SELECT **quebra o signup**.

### Testes

`tests/integration/helpers/admin.ts` expõe `createAdminClient()` (service_role, **bypassa RLS**)
para setup/teardown e `createAnonClient()` (anon). Vários testes usam o client **anon** para
*assertions* de dados — ver § 6 (riscos de quebra).

---

## 2. Inventário completo de queries

Legenda de contexto: **ANON-PUB** = visitante anônimo da página pública (ISR, `revalidate = 60`);
**ANON-ACT** = Server Action chamada por visitante anônimo; **ANON-SIGNUP** = fluxo de cadastro
sem sessão; **AUTH** = dashboard/actions com sessão.

| # | Arquivo:linha | Tabela/View | Op | Client → role | Contexto | Filtro app-layer existente |
|---|---|---|---|---|---|---|
| 1 | `lib/queries/public-page.ts:53` | `profiles` | SELECT | `createPublicClient` → **anon** | ANON-PUB | `.eq('username', username)` (citext) |
| 2 | `lib/queries/public-page.ts:61` | `links` | SELECT | `createPublicClient` → **anon** | ANON-PUB | `.eq('profile_id', profile.id)` + **`.eq('is_active', true)`** |
| 3 | `lib/actions/track-click.ts:47` | `links` | SELECT | `createPublicClient` → **anon** | ANON-ACT | `.eq('id', linkId)` — **SEM filtro `is_active`**; o estado é checado em TS (`link.is_active`) |
| 4 | `lib/actions/track-click.ts:62` | `link_clicks` | **INSERT** | `createPublicClient` → **anon** | ANON-ACT | **Nenhum no banco** — só a validação TS anterior |
| 5 | `lib/actions/auth.ts:37` | `profiles` | SELECT | `createServerClient` → **anon** (sem sessão) | ANON-SIGNUP | `.eq('username', username)` |
| 6 | `lib/actions/profile.ts:37` | `profiles` | UPDATE | `createServerClient` → **authenticated** | AUTH | `.eq('id', user.id)` |
| 7 | `lib/actions/profile.ts:65` | `profiles` | UPDATE (theme) | `createServerClient` → **authenticated** | AUTH | `.eq('id', user.id)` |
| 8 | `app/dashboard/page.tsx:20` | `profiles` | SELECT | `createServerClient` → **authenticated** | AUTH | `.eq('id', user.id).single()` |
| 9 | `app/dashboard/layout.tsx:24` | `profiles` | SELECT (theme) | `createServerClient` → **authenticated** | AUTH | `.eq('id', user.id).single()` |
| 10 | `app/dashboard/analytics/page.tsx:30` | `profiles` | SELECT (username) | `createServerClient` → **authenticated** | AUTH | `.eq('id', user.id).single()` |
| 11 | `app/dashboard/links/page.tsx:18` | `links` | SELECT `*` | `createServerClient` → **authenticated** | AUTH | `.eq('profile_id', user.id)` — **inclui links INATIVOS** |
| 12 | `lib/actions/links.ts:60` | `links` | SELECT (count) | `createServerClient` → **authenticated** | AUTH | `.eq('profile_id', user.id)` — limite de 30 |
| 13 | `lib/actions/links.ts:73` | `links` | SELECT (position) | `createServerClient` → **authenticated** | AUTH | `.eq('profile_id', user.id)` |
| 14 | `lib/actions/links.ts:84` | `links` | **INSERT** + `.select('*')` | `createServerClient` → **authenticated** | AUTH | payload `profile_id: user.id` |
| 15 | `lib/actions/links.ts:132` | `links` | UPDATE (title/url) + RETURNING | `createServerClient` → **authenticated** | AUTH | `.eq('id', id).eq('profile_id', user.id)` |
| 16 | `lib/actions/links.ts:163` | `links` | SELECT (ownership) | `createServerClient` → **authenticated** | AUTH | `.eq('profile_id', user.id)` |
| 17 | `lib/actions/links.ts:176` | `links` | UPDATE (position) | `createServerClient` → **authenticated** | AUTH | `.eq('id').eq('profile_id', user.id)` (loop) |
| 18 | `lib/actions/links.ts:199` | `links` | **DELETE** + RETURNING | `createServerClient` → **authenticated** | AUTH | `.eq('id').eq('profile_id', user.id)` |
| 19 | `lib/actions/links.ts:228` | `links` | UPDATE (`is_active`) + RETURNING | `createServerClient` → **authenticated** | AUTH | `.eq('id').eq('profile_id', user.id)` |
| 20 | `lib/analytics/clicks.ts:59` | `links` | SELECT (id,title,position) | injetado (dashboard → **authenticated**) | AUTH | `.eq('profile_id', profileId)` — **inclui inativos** |
| 21 | `lib/analytics/clicks.ts:83` | `link_click_daily` | SELECT | injetado (dashboard → **authenticated**) | AUTH | `.in('link_id', linkIds)` (ids derivados de #20) |
| 22 | `lib/analytics/clicks.ts:137` | `link_click_daily` | SELECT | injetado (dashboard → **authenticated**) | AUTH | `.in('link_id', linkIds)` + `.gte('day', cutoff)` |
| — | `handle_new_user()` (trigger em `auth.users`) | `profiles` | **INSERT** | `SECURITY DEFINER`, owner `postgres` | signup | n/a — roda fora do contexto RLS |

**Nenhum DELETE em `profiles` ou `link_clicks` na aplicação.** `link_clicks` é append-only;
`profiles` é removido só por `ON DELETE CASCADE` de `auth.users`.
**Nenhuma leitura direta de `link_clicks`** — o dashboard só lê a view.

---

## 3. Schema exato (migrations)

### `public.profiles` — `20260614220038_profiles.sql`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | **FK → `auth.users(id)` ON DELETE CASCADE** — é o `auth.uid()` |
| `username` | `citext` UNIQUE NOT NULL | CHECK 3–30, `^[a-z][a-z0-9_]*$` |
| `display_name` | `text` | público |
| `bio` | `text` | CHECK ≤ 160 · público |
| `avatar_url` | `text` | público |
| `theme` | `text` NOT NULL DEFAULT `'light'` | CHECK ∈ {light,dark,accent} · público |
| `created_at` / `updated_at` | `timestamptz` | trigger `set_updated_at` |

Triggers: `profiles_set_updated_at` (BEFORE UPDATE); `on_auth_user_created` em `auth.users`
→ `handle_new_user()` **SECURITY DEFINER, `SET search_path = public`**.
**Todas as colunas de `profiles` já são públicas hoje** (a página pública lê 5 delas via anon).

### `public.links` — `20260701173240_links.sql`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK DEFAULT `gen_random_uuid()` | |
| `profile_id` | `uuid` NOT NULL | **FK → `profiles(id)` ON DELETE CASCADE** — chave de ownership |
| `title` | `text` NOT NULL | CHECK 1–60 |
| `url` | `text` NOT NULL | CHECK `^https?://` |
| `position` | `int` NOT NULL DEFAULT 0 | |
| `is_active` | `boolean` NOT NULL DEFAULT `true` | **discrimina público vs. privado** |
| `created_at` / `updated_at` | `timestamptz` | |

Índice: `idx_links_profile_position (profile_id, position)`.

### `public.link_clicks` — `20260702011034_link_clicks.sql`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `link_id` | `uuid` NOT NULL | **FK → `links(id)` ON DELETE CASCADE** — único caminho até o dono |
| `clicked_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `user_agent_short` | `text` | CHECK ≤ 120 |
| `user_agent_hash` | `text` | sempre `null` no MVP |

Índice: `idx_link_clicks_link_clicked_at (link_id, clicked_at DESC)`.
**Não há coluna `profile_id`** → toda policy precisa de subquery/EXISTS via `links`.

### `public.link_click_daily` — `20260702120000_link_click_daily.sql`
```sql
create or replace view public.link_click_daily as
  select lc.link_id, (date_trunc('day', lc.clicked_at))::date as day, count(*)::int as clicks
  from public.link_clicks lc
  group by lc.link_id, (date_trunc('day', lc.clicked_at))::date;

grant select on public.link_click_daily to anon, authenticated;
```
- View **regular** (não materializada).
- **`security_invoker` NÃO foi declarado** → default `false`.
- Owner = `postgres` (papel que executa as migrations, que tem `BYPASSRLS` no Supabase).
- **`GRANT SELECT ... TO anon`** está ativo.

---

## 4. Resposta explícita aos 4 riscos

### R1 — Página pública ISR/anônima: qual role? Sobrevive à RLS?

**Role: `anon`, sempre.** `app/[username]/page.tsx` usa `createPublicClient()` (linhas 20 e 46 —
`generateMetadata` e o componente), que é stateless e nunca lê cookies. Isso é deliberado: ler
cookies forçaria render dinâmico e mataria o `export const revalidate = 60`.

**Consequência:** as policies de SELECT em `profiles` e `links` **precisam cobrir a role `anon`**.
Se alguém escrever `USING (auth.uid() = ...)`, `auth.uid()` retorna `NULL` no contexto anônimo →
`NULL = x` é `NULL` → falsy → **a página pública inteira vira 404 silencioso** (`fetchPublicPage`
retorna `null` em `!profile` → `notFound()`).

**Agravante de cache:** com ISR, uma renderização feita durante uma janela de policy errada é
**congelada por 60s** e servida a todos. Um deploy de RLS mal feito não falha alto — ele publica
404s cacheados. **Mitigação obrigatória:** após aplicar a migration de RLS, disparar
`revalidatePath('/[username]', 'page')` ou um redeploy, e validar `/[username]` de um perfil real
com `curl` antes de considerar a story pronta.

**Também roda como `anon`:** o signup (`lib/actions/auth.ts:37`), apesar de usar
`createServerClient()`. A policy de SELECT em `profiles` precisa permitir `anon`, senão a checagem
de username duplicado sempre retorna "livre" e o signup falha depois no UNIQUE do banco com erro
genérico.

**Veredito:** com as policies propostas em § 5, sim — a página pública continua lendo profile +
links ativos.

---

### R2 — Dashboard lista links INATIVOS do dono; policy `is_active = true` global quebraria

Confirmado: `app/dashboard/links/page.tsx:18` faz `.select('*')` filtrando **só** por
`profile_id`, sem `is_active`. `lib/analytics/clicks.ts:59` idem (analytics conta cliques de
links desativados). Uma única policy `USING (is_active = true)` esconderia links inativos do
próprio dono → toggle de desativação viraria "o link sumiu".

**Solução: duas policies PERMISSIVE de SELECT.** Policies permissivas em Postgres são combinadas
com **`OR`**, então não se anulam:

- `links_select_public` — `TO anon, authenticated` · `USING (is_active = true)`
- `links_select_own` — `TO authenticated` · `USING (profile_id = (select auth.uid()))`

Resultado: `anon` vê apenas links ativos (de qualquer perfil); `authenticated` vê **todos os
próprios** (ativos e inativos) **mais** os ativos de terceiros. A segunda parte é intencional —
um usuário logado que abre a página pública de outro precisa enxergá-la — e não vaza nada, porque
as queries do dashboard já filtram por `profile_id = user.id` na aplicação.

⚠️ **Efeito colateral em `trackLinkClick` (linha 47):** essa query lê o link **sem** filtro
`is_active` e depois checa em TS. Com a policy pública, um link inativo simplesmente **não é
visível** para `anon` → o retorno muda de `'Link inativo'` para `'Link não encontrado'`. O
comportamento externo é equivalente (o clique não é registrado nos dois casos), mas
`tests/unit/track-click-action.test.ts:106` afirma a mensagem `'Link inativo'`. Como o teste
mocka o client, ele **não quebra**, mas passa a testar um caminho morto. Ação: simplificar o
código para tratar "não encontrado" e "inativo" como o mesmo caso, ou manter os dois ramos com
um comentário. Não é bloqueante.

---

### R3 — `link_click_daily` herda RLS das tabelas base? Precisa de `security_invoker`?

**Não herda — e isso é um vazamento ATIVO hoje, que sobreviveria à RLS.**

Em Postgres, uma view sem `security_invoker` executa com os privilégios do **owner**. O owner
aqui é `postgres` (papel das migrations no Supabase, que tem `BYPASSRLS`). Somado ao
`grant select on public.link_click_daily to anon`, isso significa que **qualquer pessoa com a
anon key pode ler a agregação de cliques de TODOS os links de TODOS os perfis** via PostgREST
(`GET /rest/v1/link_click_daily`), hoje, sem sessão. Habilitar RLS em `link_clicks` **não fecha
essa porta** — a view continuaria furando.

**Correções obrigatórias na mesma migration:**
1. `ALTER VIEW public.link_click_daily SET (security_invoker = on);` (PG ≥ 15 — Supabase atende).
2. `REVOKE SELECT ON public.link_click_daily FROM anon;` — nenhum caminho anônimo lê a view.
3. `GRANT SELECT ON public.link_clicks TO authenticated;` — com `security_invoker`, o chamador
   precisa de privilégio na **tabela base**, não só na view. Sem isso o dashboard de analytics
   passa a receber `permission denied for table link_clicks`.
4. `notify pgrst, 'reload schema';`

Com `security_invoker = on`, a view passa a respeitar a policy de SELECT de `link_clicks` do
chamador → cada dono vê apenas os próprios cliques agregados. O filtro `.in('link_id', linkIds)`
em `lib/analytics/clicks.ts` vira defesa em profundidade em vez de única barreira.

⚠️ Detalhe de agregação: com `security_invoker`, o `count(*)` passa a ser calculado **sobre as
linhas visíveis**. É o comportamento desejado aqui (cada um conta o próprio), mas vale registrar
que a semântica da view muda por role.

---

### R4 — `link_clicks` aceita INSERT com anon key direto via PostgREST?

**Confirmado.** `lib/actions/track-click.ts:62` insere com `createPublicClient()` (anon key),
sem RLS e sem policy — o próprio comentário do código (linhas 10–11) e da migration registram
isso como débito diferido para a Story 6.3. Como a anon key é pública por definição
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`, exposta no bundle), **qualquer um pode fazer
`POST /rest/v1/link_clicks`** com um `link_id` arbitrário — inclusive de links inativos ou de
outro perfil — e inflar/poluir as métricas. Também é possível hoje fazer `UPDATE`/`DELETE`
em `link_clicks` com a anon key (a tabela é totalmente aberta), o que destrói o caráter
append-only.

**O que a RLS resolve:** a policy de INSERT proposta em § 5 exige, no `WITH CHECK`, que o
`link_id` referencie um link **existente e ativo** — elimina lixo e ids inventados. A ausência de
policies de UPDATE/DELETE (com RLS ligada, ausência = negação) restaura o append-only de verdade.

**O que a RLS NÃO resolve:** *click inflation* por um atacante que repete POSTs em um link ativo
legítimo. Isso exige **rate limiting** (Epic 6, story separada) ou mover o INSERT para uma função
`SECURITY DEFINER` / Edge Function com token. Fora do escopo da Story 6.3 — registrar como débito
explícito.

---

## 5. Policies propostas

Ordem de aplicação: policies **primeiro**, `ENABLE ROW LEVEL SECURITY` **por último** por tabela —
habilitar RLS sem policies nega tudo e derruba a aplicação na janela entre os statements.

> `(select auth.uid())` em vez de `auth.uid()` é intencional: força o planner a avaliar a função
> **uma vez** (InitPlan) em vez de por linha. Diferença mensurável em `links` e `link_clicks`.

### 5.1 `profiles`

Todas as colunas já são públicas hoje; a RLS aqui protege **escrita**, não leitura.

| Nome | Comando | Roles | Expressão |
|---|---|---|---|
| `profiles_select_public` | SELECT | `anon`, `authenticated` | `USING (true)` |
| `profiles_update_own` | UPDATE | `authenticated` | `USING (id = (select auth.uid()))` · `WITH CHECK (id = (select auth.uid()))` |

```sql
create policy profiles_select_public on public.profiles
  for select to anon, authenticated
  using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter table public.profiles enable row level security;
```

- **Sem policy de INSERT:** o único INSERT é o trigger `handle_new_user()`, `SECURITY DEFINER`
  com owner `postgres` (`BYPASSRLS`) → não passa pela RLS.
  **Verificar antes do deploy:** `select proowner::regrole from pg_proc where proname = 'handle_new_user';`
  deve retornar `postgres`. Se não for, o **signup quebra inteiro**.
- **Sem policy de DELETE:** remoção só por CASCADE de `auth.users` (RI interno, não sujeito a RLS).
- `WITH CHECK` no UPDATE impede reatribuir `id` para outro usuário.
- `USING (true)` no SELECT mantém a enumeração de usernames possível — **já é o caso hoje** e é
  requisito do signup (#5) e da página pública (#1). Não é regressão. Restringir colunas
  (`REVOKE ... (created_at)` ou uma view `public_profiles`) fica como melhoria futura.

### 5.2 `links`

| Nome | Comando | Roles | Expressão |
|---|---|---|---|
| `links_select_public` | SELECT | `anon`, `authenticated` | `USING (is_active = true)` |
| `links_select_own` | SELECT | `authenticated` | `USING (profile_id = (select auth.uid()))` |
| `links_insert_own` | INSERT | `authenticated` | `WITH CHECK (profile_id = (select auth.uid()))` |
| `links_update_own` | UPDATE | `authenticated` | `USING (profile_id = (select auth.uid()))` · `WITH CHECK (profile_id = (select auth.uid()))` |
| `links_delete_own` | DELETE | `authenticated` | `USING (profile_id = (select auth.uid()))` |

```sql
-- Leitura pública: só links ativos (página pública + tracking anônimo).
create policy links_select_public on public.links
  for select to anon, authenticated
  using (is_active = true);

-- Leitura do dono: TODOS os próprios links, inclusive is_active = false (dashboard).
-- PERMISSIVE → combina com a de cima via OR.
create policy links_select_own on public.links
  for select to authenticated
  using (profile_id = (select auth.uid()));

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
```

- `WITH CHECK` no UPDATE é o que impede "doar" um link para outro perfil trocando `profile_id`.
- As actions #15/#18/#19 usam `.select(...)` após UPDATE/DELETE (RETURNING). Isso exige que a
  linha também satisfaça uma policy de **SELECT** — satisfeita por `links_select_own`. ✅
- O índice `(profile_id, position)` já cobre o predicado de `links_select_own`. Para
  `links_select_public`, o predicado `is_active = true` combinado com `profile_id` continua
  usando o índice existente; considerar `idx_links_active_profile_position (profile_id, position) WHERE is_active`
  se o EXPLAIN da página pública degradar.

### 5.3 `link_clicks`

| Nome | Comando | Roles | Expressão |
|---|---|---|---|
| `link_clicks_insert_active` | INSERT | `anon`, `authenticated` | `WITH CHECK (EXISTS (select 1 from public.links l where l.id = link_id and l.is_active))` |
| `link_clicks_select_owner` | SELECT | `authenticated` | `USING (EXISTS (select 1 from public.links l where l.id = link_clicks.link_id and l.profile_id = (select auth.uid())))` |

```sql
-- INSERT anônimo (tracking da página pública), restrito a links existentes e ATIVOS.
-- A subquery é avaliada sob a RLS do chamador: anon enxerga links ativos via
-- links_select_public, então a checagem funciona sem elevar privilégio.
create policy link_clicks_insert_active on public.link_clicks
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.links l
      where l.id = link_id and l.is_active
    )
  );

-- Leitura só do dono do link (via join lógico links.profile_id). Habilita a view
-- link_click_daily com security_invoker.
create policy link_clicks_select_owner on public.link_clicks
  for select to authenticated
  using (
    exists (
      select 1 from public.links l
      where l.id = link_clicks.link_id
        and l.profile_id = (select auth.uid())
    )
  );

alter table public.link_clicks enable row level security;
```

- **Sem policy de UPDATE nem DELETE** → append-only garantido pelo banco (com RLS ligada,
  ausência de policy = negação total).
- `ON DELETE CASCADE` de `links` continua funcionando: as ações de integridade referencial são
  executadas por triggers internos que não são filtrados por RLS. Apagar um link com cliques
  segue funcionando (ação #19).
- Cleanup de testes usa `service_role` → bypassa. ✅

### 5.4 `link_click_daily` (view)

Views não recebem policies — o que importa é `security_invoker` + grants.

```sql
alter view public.link_click_daily set (security_invoker = on);

revoke select on public.link_click_daily from anon;
grant  select on public.link_click_daily to authenticated;

-- security_invoker exige privilégio na tabela BASE para o chamador.
grant select on public.link_clicks to authenticated;

notify pgrst, 'reload schema';
```

Sem o `grant` na tabela base, o dashboard de analytics recebe `permission denied for table
link_clicks` — é o erro mais provável de um rollout apressado.

### 5.5 Checklist de rollout

1. Aplicar a migration em ambiente de dev primeiro; rodar a suíte de integração **com** as
   credenciais de service role.
2. `select proowner::regrole from pg_proc where proname = 'handle_new_user';` → esperado `postgres`.
3. Smoke manual, nesta ordem: signup (username duplicado + novo) → login → dashboard/links
   (criar, editar, **desativar e confirmar que continua listado**, reordenar, excluir) →
   `/[username]` anônimo (perfil + apenas links ativos) → clicar num link → dashboard/analytics.
4. Verificar o vazamento fechado: `curl` anônimo em `/rest/v1/link_click_daily?select=*` deve
   retornar `401/permission denied` (hoje retorna dados).
5. Verificar append-only: `DELETE` anônimo em `/rest/v1/link_clicks` deve afetar 0 linhas.
6. **Invalidar o cache ISR** das páginas públicas após o deploy (§ 4/R1).

---

## 6. Queries e testes em risco de quebrar

Ordenados por severidade.

| # | Onde | Risco | Mitigação |
|---|---|---|---|
| 1 | `tests/integration/clicks-aggregation.test.ts:68,92,115,120,124,131,133` e `clicks-benchmark.test.ts:59,62,66` | **QUEBRAM.** Passam o client **anon** para `getClicksByLink`/`getDailyClicks`. Com `security_invoker` + `REVOKE ... FROM anon`, retornam `[]`/zeros e as assertions falham. | Autenticar o client de teste (`signInWithPassword` com o usuário semeado) antes de chamar os helpers. **Alteração obrigatória na Story 6.3.** |
| 2 | `tests/integration/link-clicks.test.ts:107,119` | **QUEBRAM.** Leem `link_clicks` com anon; `link_clicks_select_owner` só cobre `authenticated`. As linhas 107/119 aparentam ser justamente o teste de isolamento entre perfis — passariam a testar outra coisa. | Migrar para client autenticado; converter a asserção "não vê o do outro" em teste real de RLS. |
| 3 | `tests/integration/links-crud.test.ts:142,151`, `links.test.ts:64,73,103`, `links-reorder.test.ts:128` | **RISCO ALTO.** Verificam efeitos de UPDATE/DELETE lendo com anon. Se a linha inspecionada estiver com `is_active = false`, `links_select_public` a esconde e a asserção lê `null`. | Revisar caso a caso; usar `createAdminClient()` para verificação de estado pós-mutação. |
| 4 | `lib/actions/auth.ts:37` (signup, role **anon**) | **QUEBRARIA** com qualquer policy de SELECT em `profiles` baseada em `auth.uid()`. Falha silenciosa: username "livre" → erro genérico no UNIQUE. | `profiles_select_public USING (true)` cobre. **Não restringir SELECT de `profiles` a authenticated.** |
| 5 | `lib/queries/public-page.ts:53,61` (página pública, role **anon**) | **QUEBRARIA** por policy exigindo `auth.uid()`. Pior: falha vira `notFound()` **cacheado por 60s**. | Policies `TO anon` + invalidação de ISR pós-deploy (§ 5.5 item 6). |
| 6 | `app/dashboard/links/page.tsx:18` e `lib/analytics/clicks.ts:59` | **QUEBRARIAM** com policy única `is_active = true`: links inativos sumiriam do dashboard e do analytics. | Duas policies PERMISSIVE (`links_select_public` OR `links_select_own`). |
| 7 | `lib/analytics/clicks.ts:83,137` (view) | **QUEBRA** se `security_invoker` for ligado **sem** `GRANT SELECT ON public.link_clicks TO authenticated`. | Grant na mesma migration (§ 5.4). |
| 8 | `lib/actions/links.ts:132,199,228` (mutations com RETURNING) | Falha se houver UPDATE/DELETE sem policy de SELECT correspondente. | `links_select_own` cobre. ✅ |
| 9 | `lib/actions/track-click.ts:47` | Não quebra, mas **muda comportamento**: link inativo passa de `'Link inativo'` para `'Link não encontrado'`. `tests/unit/track-click-action.test.ts:106` continua verde (mocka o client) mas cobre caminho morto. | Simplificar os dois ramos em um, ou documentar. Não bloqueante. |
| 10 | `handle_new_user()` (trigger) | Quebraria o signup se o owner não tiver `BYPASSRLS`. | Verificar `proowner` antes do deploy (§ 5.5 item 2). |
| 11 | `app/health/route.ts` | Sem risco — só `auth.getSession()`, não toca tabelas. | — |

### Débitos que a RLS NÃO fecha (registrar no Epic 6)
- **Click inflation:** `link_clicks_insert_active` bloqueia ids inválidos/inativos, mas não impede
  POSTs repetidos em um link ativo legítimo. Precisa de rate limiting ou de mover o INSERT para
  uma função `SECURITY DEFINER` com token. Story separada.
- **Enumeração de perfis e de links ativos** via PostgREST com anon key permanece possível por
  design (são dados públicos). Se virar preocupação, expor uma view `public_profiles` restrita e
  revogar SELECT direto nas tabelas.
