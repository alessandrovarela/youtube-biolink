# Runbook — Recolocar os ambientes no ar do zero

> **Quando usar:** você deletou (ou vai deletar) os projetos Supabase e/ou o projeto Vercel
> e quer reconstituir tudo. **Nada precisa ser reprogramado** — o schema, a config de auth,
> o código e o pipeline CI/CD estão versionados no git. Isto aqui é só **re-fiação de
> credenciais** + aplicar migrations. Tempo estimado: **15–25 min**.

> **Pausar vs deletar:** se o objetivo for só parar de gastar, **pausar** o Supabase no
> dashboard é reversível com um clique (dados incluídos) e dispensa este runbook. A Vercel
> no hobby tier não cobra. Este runbook é para o caso de **deletar de fato**.

---

## O que o git já reproduz (você NÃO refaz nada disto)

- **Schema completo** — 11 migrations em `supabase/migrations/` (tabelas, trigger de
  signup `handle_new_user`, RLS nas 3 tabelas, RPCs `record_link_click`/`check_rate_limit`/
  `check_app_rate_limit`, view `link_click_daily` blindada, `rate_limit_counters`).
- **Config de auth do projeto** — `supabase/config.toml` (site_url, redirect URLs,
  `enable_signup`, confirmação de e-mail), parametrizada por env vars.
- **App + pipeline** — código no git; a Vercel redeploya sozinha a cada push na `main`.
- **Sem seed** — o app funciona com tabelas vazias (usuários se cadastram normalmente).

O que se perde ao deletar: **os dados** (profiles, links, cliques) e todas as **credenciais**
(URLs, keys, refs, senhas) — que são regeneradas nos projetos novos.

---

## Antes de deletar (opcional, se algum dado importar)

```bash
# Backup dos dados de produção (o schema já está no git; isto é só os DADOS)
supabase link --project-ref <REF_PROD_ATUAL>
supabase db dump --data-only -f backup-prod-dados.sql
```

Anote também, do dashboard atual, quaisquer settings de auth que você tenha mudado à mão e
que não estejam no `config.toml`.

---

## Pré-requisitos

```bash
supabase --version   # Supabase CLI  (npm i -g supabase  ou  brew install supabase/tap/supabase)
vercel --version     # Vercel CLI     (npm i -g vercel)
gh auth status       # GitHub CLI autenticado
node --version       # Node 20+
supabase login       # autentica o CLI (abre o browser)
```

---

## Passo A — Criar os 2 projetos Supabase (dev + prod)

Pelo dashboard (mais simples): https://supabase.com/dashboard → **New project**, duas vezes:
`youtube-biolink-dev` e `youtube-biolink-prod`. Guarde de cada um:

| Campo | Onde achar no dashboard |
|-------|-------------------------|
| **Project ref** | Settings → General → Reference ID |
| **Project URL** | Settings → API → Project URL |
| **anon key** | Settings → API → Project API keys → `anon` `public` |
| **service_role key** | Settings → API → Project API keys → `service_role` (secreta!) |
| **DB password** | a que você definiu ao criar (ou reset em Settings → Database) |
| **Access token** | https://supabase.com/dashboard/account/tokens (é de CONTA, serve p/ os dois) |

---

## Passo B — Aplicar as migrations aos dois projetos

**Dev** (manual, do seu terminal):

```bash
supabase link --project-ref <REF_DEV>
supabase db push          # aplica as 11 migrations em ordem
```

**Prod** — o jeito canônico é deixar o **CD** aplicar (Passo F). Mas dá para forçar manual:

```bash
supabase link --project-ref <REF_PROD>
supabase db push
```

Confirme no dashboard → Table Editor que `profiles`, `links`, `link_clicks`,
`rate_limit_counters` e a view `link_click_daily` existem, e que RLS está "Enabled" nas tabelas.

---

## Passo C — Aplicar a config de auth (site_url + redirects + confirmação de e-mail)

O `config.toml` referencia estas env vars — defina-as no shell **por projeto** e rode
`supabase config push` apontando para cada um:

```bash
# --- PROD ---
export SUPABASE_AUTH_SITE_URL="https://<seu-dominio-vercel>.vercel.app"
export SUPABASE_AUTH_REDIRECT_1="https://<seu-dominio-vercel>.vercel.app/auth/callback"
export SUPABASE_AUTH_REDIRECT_2="https://<seu-dominio-vercel>.vercel.app/reset-password/confirm"
supabase link --project-ref <REF_PROD>
supabase config push

# --- DEV ---
export SUPABASE_AUTH_SITE_URL="http://localhost:3000"
export SUPABASE_AUTH_REDIRECT_1="http://localhost:3000/auth/callback"
export SUPABASE_AUTH_REDIRECT_2="http://localhost:3000/reset-password/confirm"
supabase link --project-ref <REF_DEV>
supabase config push
```

> `enable_confirmations = true` no `config.toml` → **signup exige confirmação de e-mail**.
> O e-mail é o built-in do Supabase (sem SMTP customizado no MVP). No smoke test, confirme
> pela caixa de entrada real (ou use o Inbucket do dashboard).

---

## Passo D — Secrets do GitHub (CI/CD)

O CI usa dois grupos de secrets. Todos como **secret de REPOSITÓRIO** (`gh secret set`),
**não** de environment — ver armadilha #1.

```bash
# Job `quality` (typecheck/lint/testes de integração + build) — usa o projeto DEV:
gh secret set SUPABASE_URL_DEV             --body "https://<REF_DEV>.supabase.co"
gh secret set SUPABASE_ANON_KEY_DEV        --body "<ANON_KEY_DEV>"
gh secret set SUPABASE_SERVICE_ROLE_KEY_DEV --body "<SERVICE_ROLE_KEY_DEV>"

# Job `migrate-production` — aplica migrations no projeto PROD:
gh secret set SUPABASE_ACCESS_TOKEN        --body "<ACCESS_TOKEN>"
gh secret set SUPABASE_DB_PASSWORD         --body "<DB_PASSWORD_PROD>"
gh secret set SUPABASE_PROJECT_REF_PROD    --body "<REF_PROD>"

# Rate limiting — preflight + build (ver armadilha #2). Valor próprio, distinto:
gh secret set RATE_LIMIT_PEPPER            --body "$(openssl rand -hex 32)"

gh secret list   # confirmar os 7
```

---

## Passo E — Projeto Vercel + env vars

1. **Criar/linkar o projeto** e conectar ao repo GitHub (para deploy automático no push):
   dashboard Vercel → **Add New → Project → Import** o repo `youtube-biolink`. Ou:
   ```bash
   vercel link      # linka a pasta local ao projeto Vercel
   ```
2. **Env vars** (Settings → Environment Variables). Cada uma em **Production E Preview**;
   Production aponta para o Supabase **prod**, Preview para o **dev**:

```bash
# Production  (valores do projeto PROD)
vercel env add NEXT_PUBLIC_SUPABASE_URL production        # https://<REF_PROD>.supabase.co
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production   # <ANON_KEY_PROD>
vercel env add RATE_LIMIT_PEPPER production --sensitive   # openssl rand -hex 32 (novo, distinto)

# Preview  (valores do projeto DEV)
vercel env add NEXT_PUBLIC_SUPABASE_URL preview --yes
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview --yes
vercel env add RATE_LIMIT_PEPPER preview --sensitive --yes   # outro valor, distinto do de prod
```

> ⚠️ Se o CLI travar num loop pedindo "git branch" no Preview, use `vercel@latest` via
> `npx -y vercel@latest env add ...` (bug conhecido de versões antigas do CLI).

---

## Passo F — Deploy + verificação

```bash
git commit --allow-empty -m "chore: redeploy pos-reprovisioning [ops]"
git push origin main       # dispara: quality → migrate-production → deploy Vercel
gh run watch               # acompanha o CD
```

Ordem que o CD executa: `quality` (build exige `RATE_LIMIT_PEPPER`) → `migrate-production`
(`supabase link` + `supabase db push` no prod) → Vercel redeploya.

**Verificação pós-deploy** (as sondas do PRE-M7 — trocar `<PROD>` pela URL de prod e
`<ANON>` pela anon key de prod; nenhuma escreve nada):

```bash
PROD="https://<REF_PROD>.supabase.co"; ANON="<ANON_KEY_PROD>"
FAKE="00000000-0000-0000-0000-000000000000"
# 1) RLS ativa — INSERT anônimo em link_clicks deve dar 401
curl -s -o /dev/null -w "1) %{http_code} (esperado 401)\n" -X POST "$PROD/rest/v1/link_clicks" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d "{\"link_id\":\"$FAKE\"}"
# 2) View blindada — leitura anônima da agregação deve dar 401
curl -s -o /dev/null -w "2) %{http_code} (esperado 401)\n" "$PROD/rest/v1/link_click_daily?select=*&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# 3) RPC de tracking existe (link fake → false, sem gravar)
curl -s -w " -> 3) tracking RPC ok\n" -X POST "$PROD/rest/v1/rpc/record_link_click" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d "{\"p_link_id\":\"$FAKE\"}"

# App (Vercel): headers de segurança + auth guard
APP="https://<seu-dominio>.vercel.app"
curl -sI "$APP/" | grep -i content-security-policy   # deve existir
curl -s -o /dev/null -w "guard: %{http_code} (esperado 307)\n" "$APP/dashboard"
curl -s -o /dev/null -w "health: %{http_code} (esperado 200)\n" "$APP/health"
```

Rode também o smoke test manual: `docs/smoke-test.md`.

---

## Tabela de referência — todas as env vars / secrets

| Nome | Onde vive | Valor | Server-only? |
|------|-----------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (prod+preview), `.env.local` | URL do projeto Supabase | não (público) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (prod+preview), `.env.local` | anon key | não (público) |
| `RATE_LIMIT_PEPPER` | Vercel (prod+preview) **+ GitHub (repo)**, `.env.local` | `openssl rand -hex 32`, distinto por ambiente | **SIM — nunca `NEXT_PUBLIC_`** |
| `SUPABASE_URL_DEV` | GitHub secret | URL do projeto dev | — |
| `SUPABASE_ANON_KEY_DEV` | GitHub secret | anon key dev | — |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | GitHub secret | service_role dev (testes de integração) | **SIM** |
| `SUPABASE_ACCESS_TOKEN` | GitHub secret | token de conta (CLI) | **SIM** |
| `SUPABASE_DB_PASSWORD` | GitHub secret | senha do DB prod | **SIM** |
| `SUPABASE_PROJECT_REF_PROD` | GitHub secret | ref do projeto prod | — |
| `SUPABASE_AUTH_SITE_URL` | shell, para `supabase config push` | domínio do ambiente | — |
| `SUPABASE_AUTH_REDIRECT_1/2` | shell, para `supabase config push` | `/auth/callback`, `/reset-password/confirm` | — |

Para o `.env.local` (dev local): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`RATE_LIMIT_PEPPER` (+ `SUPABASE_SERVICE_ROLE_KEY` se for rodar testes de integração local).

---

## Armadilhas (já pegaram a gente antes)

1. **`RATE_LIMIT_PEPPER` tem que ser secret de REPOSITÓRIO no GitHub, não de environment.**
   O job `quality` não declara `environment:`; um secret escopado só ao environment
   `production` fica **invisível** para ele → `quality` falha → `migrate-production` tem
   `needs: quality` → as migrations **não aplicam** e a `main` fica com código novo e schema
   velho.

2. **Sem `RATE_LIMIT_PEPPER`, o build de produção FALHA de propósito** (`assertProductionEnv`
   em `next.config.ts`). É um gate: um deploy mal provisionado quebra no build, não meses
   depois com o login retornando 500. Então provisione o pepper (GitHub + Vercel) **antes**
   do primeiro push.

3. **Ordem importa:** criar projetos → aplicar migrations no dev → provisionar TODOS os
   secrets/env → só então push na `main`. Se o CD rodar antes das credenciais certas, quebra.

4. **Enquanto os projetos estiverem deletados, o CI/CD vai FALHAR em todo push** (o
   `migrate-production` não consegue linkar um prod inexistente; a Vercel não tem projeto).
   Isso é esperado — o pipeline fica dormente até você reprovisionar por este runbook.

5. **Confirmação de e-mail está ON** (`enable_confirmations = true`). O signup precisa do
   clique no e-mail. Sem SMTP customizado, é o e-mail built-in do Supabase.

6. **Se o `migrate-production` falhar com `Failed to resolve latest Supabase CLI release:
   rate limit exceeded`** — é uma flake TRANSITÓRIA da API do GitHub baixando o CLI, não um
   problema do teu banco/código. As migrations nem foram tentadas. Basta re-rodar:
   `gh run rerun <run-id> --failed`. O `ci.yml` já pina a versão do CLI (`version: 2.75.0`)
   justamente para minimizar isso; se quiser um CLI mais novo, bump o pin conscientemente.
