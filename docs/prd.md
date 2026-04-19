# youtube-biolink Product Requirements Document (PRD)

> **Status:** Approved v1.1
> **Autor:** Morgan (Product Manager)
> **Data:** 2026-04-17 (v1.1)
> **Insumo:** `docs/brief.md` v1.0 (aprovado por Alessandro Varela em 2026-04-16); `docs/architecture.md` v0.3 § 20.3 (tabela de reconciliação canônica)
> **Modo de geração:** YOLO na v1.0 (interactive skipped a pedido do owner); v1.1 é reconciliação determinística contra a arquitetura v0.3
> **Aprovado por:** Alessandro Varela em 2026-04-17 (v1.0 e v1.1) — liberado para handoff ao @ux-design-expert e @sm

---

## 1. Goals and Background Context

### Goals

- Publicar biolink funcional (signup → página `/@user` em <5min) em produção, com free tier Vercel + Supabase.
- Ensinar os **6 pilares fullstack** (Auth, DB/RLS, SSR/RSC, CI/CD, Analytics, Design System) integrados em um único produto real.
- Garantir **100% de story coverage** — toda feature nasce como story documentada com contexto + AC + decisões técnicas.
- Entregar **reprodutibilidade <15min** — dev externo clona, configura `.env.local` apontando para projeto Supabase Cloud e roda localmente seguindo o README.
- Consolidar um repositório **self-contained** em pt-BR: docs, stories e commits como material didático completo, sem dependência de vídeos/blog externos.
- Servir como projeto-portfólio de referência para aprendiz TS/React/backend migrar para Next.js 16 + Supabase moderno.
- Manter disciplina de **conventional commits + stories estruturadas** ao longo de todo o ciclo (valor didático = qualidade de commits/stories).

### Background Context

Tutoriais fullstack atuais são abundantes, mas fragmentados: cobrem um pilar por vez e raramente mostram a junção real — RLS + SSR + auth cookies, ou CI/CD + migrations + deploy. Aprendizes com base em React e backend REST travam quando precisam conectar tudo em um produto publicável, e projetos de estudo típicos (hard-coded, sem deploy, sem RLS) não convencem recrutadores nem consolidam prática. A janela para um projeto-referência é 2026+: Next.js 16 (App Router + RSC) estabilizou, Supabase consolidou-se como BaaS de referência não-enterprise, e materiais de 2021-2022 em Pages Router estão obsoletos.

O **youtube-biolink** responde a esse gap construindo um biolink estilo Linktree como produto real e, simultaneamente, como currículo vivo: cada commit é uma aula, cada story é um capítulo, cada deploy é um exercício validado em produção. O escopo é propositalmente enxuto (auth e-mail/senha, 3 temas fixos, sem OAuth/domínios customizados/billing no MVP) para que a energia didática vá para **engenharia**, não regras de negócio. Publicado sob licença MIT, pt-BR, sem deadline fixo — entrega regida por Definition of Done, não por cronograma.

### Change Log

| Date       | Version | Description                                                                                                   | Author      |
|------------|---------|---------------------------------------------------------------------------------------------------------------|-------------|
| 2026-04-17 | 0.1     | Draft inicial do PRD a partir de `docs/brief.md` v1.0                                                         | Morgan (PM) |
| 2026-04-17 | 0.2     | Ajustes do owner: Next.js 16; remoção de E2E/Playwright; sem Supabase local (apenas cloud); stories em pt-BR | Morgan (PM) |
| 2026-04-17 | 1.0     | **Aprovado pelo owner (Alessandro Varela); promovido para v1.0 e liberado para handoff ao @architect**       | Morgan (PM) |
| 2026-04-17 | 1.1     | Reconciliação com arquitetura v0.3 (simplificação didática): NFR3 e NFR18 reformulados; FR21 reformulado; Story 2.2 removida (migra para Epic 6); ACs de RLS/rate-limit removidas de 2.4, 2.6, 2.7, 3.1, 5.1, 5.2; Epic 6 (Segurança em Camadas & Hardening) adicionado pós-Epic 5; Checklist H1/H2/H4 marcadas resolvidas e H3 movida para Epic 6. **Aprovado pelo owner (Alessandro Varela); liberado para handoff ao @ux-design-expert e @sm.** | Morgan (PM) |

---

## 2. Requirements

### Functional

- **FR1:** Usuário pode criar conta com e-mail e senha via Supabase Auth.
- **FR2:** Sistema envia e-mail de verificação no signup; login só é liberado após confirmação do e-mail.
- **FR3:** Usuário autenticado faz login com credenciais (e-mail + senha); sessão persiste via cookies server-side.
- **FR4:** Usuário pode solicitar reset de senha por e-mail e definir nova senha via link de recuperação.
- **FR5:** Usuário pode fazer logout, invalidando a sessão atual.
- **FR6:** Middleware Next.js protege rotas autenticadas (`/dashboard/*`), redirecionando visitantes anônimos para login.
- **FR7:** Durante signup, usuário escolhe **username único** (case-insensitive), validado contra lista de reservados (`admin`, `api`, `dashboard`, `login`, `signup`, etc.) e contra duplicatas.
- **FR8:** Usuário autenticado pode editar perfil: nome de exibição, bio (até 160 caracteres), URL de avatar (URL externa, validada como http(s)).
- **FR9:** Usuário autenticado pode criar, listar, editar e deletar links (CRUD completo).
- **FR10:** Cada link possui: título (obrigatório, ≤60 caracteres), URL destino (obrigatória, validada), ordem de exibição (inteiro), e flag ativo/inativo.
- **FR11:** Usuário pode reordenar seus links via drag-and-drop no dashboard; nova ordem persiste imediatamente.
- **FR12:** Usuário pode alternar link entre ativo e inativo; apenas ativos aparecem na página pública.
- **FR13:** Sistema sanitiza URLs de link, bloqueando schemes `javascript:`, `data:`, `vbscript:`, `file:` e aceitando apenas `http(s)://`.
- **FR14:** Página pública `/{@username}` é acessível sem autenticação, renderizada via SSR (RSC), e exibe avatar, nome, bio, e lista de links ativos ordenados.
- **FR15:** Links na página pública abrem em nova aba (`target="_blank" rel="noopener noreferrer"`).
- **FR16:** Página pública para username inexistente retorna 404 com layout próprio.
- **FR17:** Sistema oferece 3 temas pré-definidos (`light`, `dark`, `accent`); usuário escolhe um no dashboard e a escolha persiste no perfil.
- **FR18:** Tema selecionado aplica-se à página pública do usuário e ao dashboard.
- **FR19:** Sistema registra um evento de clique sempre que um link da página pública é acionado, incluindo: `link_id`, `clicked_at` (timestamp server-side), e `user_agent` truncado; persiste via Server Action sem exposição de endpoint público cru.
- **FR20:** Dashboard de analytics exibe: total de cliques por link (acumulado e últimos 7/30 dias) e total por dia (gráfico de linha simples).
- **FR21:** _(deferido para Epic 6)_ Endpoints de signup, login, reset e tracking de clique aplicam rate limiting (por IP + por conta quando aplicável). No MVP funcional (Epics 1–5) não há rate limiting; a proteção entra como unidade didática dedicada no Epic 6 (Segurança em Camadas & Hardening).
- **FR22:** Migrations de banco ficam versionadas em `supabase/migrations/` com convenção `{timestamp}_{descricao}.sql`, aplicadas ao projeto cloud via `supabase db push`.
- **FR23:** Repositório inclui README em pt-BR com instruções de setup local reproduzível em <15 minutos (pré-requisitos, clone, preencher `.env.local` com credenciais do projeto Supabase Cloud de desenvolvimento, `pnpm install`, `pnpm dev`).
- **FR24:** Cada feature implementada possui uma story correspondente em `docs/stories/{epic}.{story}.md` com contexto, AC e Change Log.

### Non Functional

- **NFR1:** **Performance web:** LCP <2.5s, TTI <3s em 4G; bundle inicial <150KB gzipped; páginas públicas servidas com cache agressivo (`s-maxage`/`stale-while-revalidate`).
- **NFR2:** **Disponibilidade:** 99% uptime da instância de referência (medido mensalmente em Vercel).
- **NFR3:** **Autorização em camadas.** No MVP (Epics 1–5) a autorização é **application-layer**: Server Actions filtram por `auth.uid()` / `profile_id = auth.uid()` em toda leitura e escrita de dados de usuário. **Row Level Security** em `profiles`, `links` e `link_clicks` é introduzida no **Epic 6 (Segurança em Camadas & Hardening)** como unidade didática dedicada (defense-in-depth). Ao final do Epic 6, toda tabela multi-tenant deve ter RLS habilitada com policies que repliquem (e reforcem) a autorização da app-layer.
- **NFR4:** **HTTPS exclusivo** em produção; HSTS configurado; CSP básica aplicada (`default-src 'self'`; avaliar allowlist por asset).
- **NFR5:** **TypeScript strict mode** ativado (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`) — zero `any` implícito permitido no código de produção.
- **NFR6:** **Pipeline CI verde** na `main`: `typecheck` + `lint` + `test` + `build` executados em todo PR e merge.
- **NFR7:** **Reprodutibilidade local** <15min: qualquer dev com Node 20+ e pnpm consegue rodar o projeto (apontado ao projeto Supabase Cloud de desenvolvimento) seguindo o README.
- **NFR8:** **Free tier compliance:** operar dentro dos limites de Supabase (500MB DB, 1GB Storage, 50k MAU, 2 projetos — `production` + `development`) e Vercel (100GB bandwidth/mês); GitHub Actions <2000min/mês.
- **NFR9:** **Conventional Commits** enforced via `commitlint` em hook local (`husky`) e validado em CI.
- **NFR10:** **Secrets** apenas via variáveis de ambiente; `.env.local` gitignored; `.env.example` presente com placeholders.
- **NFR11:** **Acessibilidade WCAG 2.1 AA** nas páginas públicas e no dashboard (contraste, navegação por teclado, ARIA onde aplicável).
- **NFR12:** **Compatibilidade:** evergreen browsers (Chrome, Firefox, Safari, Edge — últimas 2 versões estáveis).
- **NFR13:** **Material didático em pt-BR** para MVP (stories, docs internas, README); textos de UI em pt-BR.
- **NFR14:** **Licença MIT** no arquivo `LICENSE` (código + docs cobertas).
- **NFR15:** **Testes unitários e de integração** cobrindo funções críticas (sanitização de URL, validação de username, helpers de RLS, agregação de cliques) — meta: cobertura ≥70% nessas áreas. Integração roda contra o projeto Supabase Cloud `development` usando credenciais isoladas em CI.
- **NFR16:** **Migrations idempotentes** e aplicáveis em ordem (`supabase db push` funciona tanto em ambiente `development` quanto `production` sem drift).
- **NFR17:** **Story coverage = 100%** — toda feature MVP tem story em `docs/stories/` antes de merge na `main`.
- **NFR18:** **Rate limiting** em `/signup`, `/login`, `/reset-password`, e tracking de clique é entregue no **Epic 6 (Segurança em Camadas & Hardening)**. Targets de referência preservados (≥10 req/min por IP em endpoints sensíveis; signup 5/h/IP; login 10/15min/IP; reset 3/h/IP; tracking 60/min/IP/linkId). A escolha técnica (Supabase-native via RPC, Upstash, Vercel KV ou equivalente) fica a cargo do @architect no Epic 6. No MVP funcional (Epics 1–5) não há rate limiting ativo.
- **NFR19:** **Sem PII desnecessário:** `link_clicks` não armazena IP raw nem user-agent completo; user-agent truncado em ≤120 chars.
- **NFR20:** **Rollback seguro:** deploy na Vercel preserva últimos 10 deploys; migration destrutiva requer PR com label `db:destructive` e revisão manual.

---

## 3. User Interface Design Goals

### Overall UX Vision

Interface **propositalmente simples e didática-profissional**. Dois modos claros:
1. **Página pública** (`/@user`) — minimalista, rápida, mobile-first, carrega bem mesmo em 3G. Serve tanto ao visitante final quanto ao aprendiz que está estudando o SSR.
2. **Dashboard** — direto, sem fricção: poucas telas, forms inline, feedback imediato. Cada interação deve ser rastreável via story.

O estilo visual se alinha ao pedido "bonito o bastante para não parecer estudo, simples o bastante para ensinar" — sem motion gratuito, sem dark patterns, sem gamification.

### Key Interaction Paradigms

- **Mobile-first responsivo:** todas as telas desenhadas a partir de 360px; desktop é progressive enhancement.
- **Forms inline, sem modais desnecessários:** edição de link, perfil e tema acontece na própria lista/página, com `optimistic update` quando seguro.
- **Drag-and-drop com fallback acessível:** reordenação principal por arraste (mouse/toque); botões "mover ↑/↓" disponíveis como alternativa keyboard/screen-reader friendly.
- **Confirmações destrutivas explícitas:** deletar link ou conta exige confirmação textual (ex.: digitar "deletar").
- **Feedback imediato via toasts/status inline:** nenhuma ação silenciosa; sucesso e erro sempre visíveis.
- **Loading states preservam layout:** sem CLS — skeletons ou placeholders com tamanho previsível.

### Core Screens and Views

- **Signup** (`/signup`) — form: e-mail, senha, username
- **Confirmação de e-mail** (`/auth/confirm`) — landing pós-verificação
- **Login** (`/login`) — form: e-mail, senha, link "esqueci a senha"
- **Reset de senha** (`/reset-password`) — request + confirm (2 telas)
- **Dashboard — Perfil** (`/dashboard`) — editar nome, bio, avatar URL; seletor de tema
- **Dashboard — Links** (`/dashboard/links`) — listar, criar, editar, deletar, reordenar, toggle ativo
- **Dashboard — Analytics** (`/dashboard/analytics`) — total de cliques por link, gráfico por período
- **Página pública** (`/@username`) — avatar, bio, lista de links clicáveis, tema aplicado
- **404 de username** (`/@username` inexistente) — layout próprio

### Accessibility: WCAG AA

- Contraste mínimo 4.5:1 em todos os temas (validar cada um dos 3).
- Navegação completa por teclado em dashboard e página pública.
- ARIA labels em drag-and-drop, toasts e estados de loading.
- `lang="pt-BR"` no HTML; `alt` obrigatório em imagens.

### Branding

- **Tom:** neutro, tipografia sans-serif sistema (`ui-sans-serif`/`Inter` opcional), sem logo específico do produto além do wordmark "youtube-biolink".
- **3 Temas pré-definidos** (selecionáveis pelo usuário, persistidos no perfil):
  - `light` — fundo claro, tipografia escura, acento azul neutro.
  - `dark` — fundo escuro, tipografia clara, acento igual.
  - `accent` — fundo claro com destaques em cor vibrante (accent primário); pensado como "marca própria".
- Cada tema define tokens em CSS variables (`--color-bg`, `--color-fg`, `--color-accent`, `--radius`, etc.).
- Sem customização além dos 3 temas no MVP; color picker e CSS custom ficam para Phase 2.

### Target Device and Platforms: Web Responsive

- **Primário:** Web responsivo desktop + mobile (360px a 1440px+).
- **Sem** apps nativos, PWA offline completa, ou versão desktop-only no MVP.

---

## 4. Technical Assumptions

### Repository Structure: Monorepo

Monorepo simples (não pacotes múltiplos): aplicação Next.js na raiz, diretórios auxiliares para banco e docs.

```
youtube-biolink/
├── app/                  # Next.js App Router
├── components/           # componentes React (UI primitivos + compostos)
├── lib/                  # helpers (supabase clients, validations, auth)
├── supabase/
│   ├── migrations/       # SQL migrations versionadas (aplicadas via `supabase db push` ao projeto cloud)
│   └── seed.sql          # dados opcionais de desenvolvimento
├── docs/
│   ├── prd.md            # este documento
│   ├── brief.md
│   ├── architecture/     # output do @architect
│   └── stories/          # stories por epic (epic.story.md)
├── tests/                # Vitest (unit + integration)
├── .github/workflows/    # CI/CD
└── .env.example
```

### Service Architecture

**CRITICAL DECISION — Monolito Next.js + Supabase BaaS Cloud-only:**

- Aplicação Next.js única (App Router + RSC) hospedada na Vercel.
- Supabase como **BaaS** (Postgres + Auth + Storage) — **apenas cloud**, sem instância local.
- **Dois projetos Supabase Cloud:** `production` (consumido pela `main` e preview deploys de `main`) e `development` (consumido por devs rodando localmente e por integration tests em CI). Free tier permite os 2 projetos.
- **Server Actions** para mutações de dados do dashboard (preferência sobre Route Handlers, reduz boilerplate).
- **Route Handlers** apenas para callbacks auth (`/auth/callback`) e eventuais webhooks futuros.
- **Sem microserviços, sem filas, sem workers externos no MVP** — simplicidade didática.
- Dois clientes Supabase distintos: `createServerClient()` (com cookies) e `createBrowserClient()` (public anon) — ensina a separação em SSR cookie-based. **No MVP (Epics 1–5) não há `createAdminClient` (SERVICE_ROLE)**; sem RLS ativo, não existe bypass a ser executado. O admin client volta junto com o Epic 6 quando a RLS for introduzida (ex.: insert de `link_clicks` com `security definer` ou Service Role).

### Testing Requirements

**CRITICAL DECISION — Unit + Integration (MVP); sem E2E automatizado:**

- **Unit:** Vitest + React Testing Library para componentes e helpers. Meta de cobertura ≥70% em `lib/` (funções puras: sanitize URL, validate username, aggregate clicks).
- **Integration:** Vitest com ambiente Node, testando Server Actions contra o projeto Supabase Cloud `development` (credenciais isoladas em CI via GitHub secrets). Valida RLS policies empiricamente.
- **Sem E2E automatizado no MVP.** Playwright e similares ficam **fora de escopo** inclusive em Phase 2 (a menos que revisão futura justifique). Validação ponta a ponta é feita por **smoke test manual** documentado (Story 5.6) após cada release candidate.
- **Manual QA convenience:** script `pnpm seed:dev` que popula o projeto Supabase `development` com 1 user + 5 links para teste interativo.
- **Stories explicitam testes:** cada story de backend/dados tem AC de "teste local executável via `pnpm test -- {arquivo}` conectado ao projeto `development`".

### Additional Technical Assumptions and Requests

- **Stack travada (não negociável no MVP):**
  - Next.js **16** (App Router + React Server Components obrigatórios).
  - TypeScript **strict**.
  - Tailwind CSS para styling; tokens via CSS variables.
  - Supabase (Postgres 15+, Auth, Storage) — **somente cloud**; migrations via Supabase CLI com `supabase db push` contra o projeto apontado.
  - Vercel para hosting (free tier).
  - GitHub Actions para CI/CD.
  - pnpm como package manager (lockfile commitado).
  - Node 20+.
- **Biblioteca UI base:** começar com **shadcn/ui** (copiando componentes, não dependência) para acelerar primitivos; customizar para os 3 temas.
- **Validação de inputs:** `zod` em todas as boundaries (Server Actions, forms client-side).
- **Drag-and-drop:** `@dnd-kit/core` (acessível, mantido); evitar alternativas baseadas em HTML5 native DnD puro.
- **Gráficos (analytics):** biblioteca mínima (`recharts` ou `tremor`) — decisão final pelo @architect, preferência por menor peso de bundle.
- **Licença:** MIT. Arquivo `LICENSE` na raiz.
- **Idioma de UI e docs:** pt-BR no MVP; i18n adiado para Phase 2.
- **Timeline:** sem deadline fixo; entrega por **Definition of Done** (todos os FRs do MVP + pipeline verde + 3 reproduções externas validadas).
- **Público presumido:** TS + React + noção de backend. Stories podem pular fundamentos de JS/React e assumir `async/await`, hooks e tipagem como conhecidos; foco didático é **integração fullstack**, não basics.
- **Documentação:** stories são a principal fonte didática; `architecture/` fica sob responsabilidade do @architect; **não** construir site Docusaurus no MVP (adiado).
- **Deploy preview:** toda branch de story gera preview automático na Vercel (PR review usa URL real). Previews de `main` usam projeto Supabase `production`; previews de feature branches usam `development`.
- **Observabilidade MVP-light:** logs estruturados nas Server Actions críticas (auth, tracking); Sentry/Axiom adiados para Phase 2.
- **Versionamento de dependências:** Renovate ou Dependabot habilitado; atualizações em PRs automatizados reviewados em lote mensal.

---

## 5. Epic List

1. **Epic 1 — Fundação & Canary:** estabelecer infra do projeto (Next.js 16 + TS strict + Tailwind + Supabase Cloud + CI/CD) e entregar deploy público de uma rota canary `/health` que comprova conexão com o banco.
2. **Epic 2 — Autenticação & Identidade:** entregar signup/login/reset/logout com verificação de e-mail, middleware de proteção e perfil editável com username único.
3. **Epic 3 — Links & Página Pública:** CRUD de links no dashboard (com reorder, toggle ativo, sanitização de URL) e página pública SSR `/@username` exibindo os links ativos.
4. **Epic 4 — Design System & Temas:** tokens, primitivos UI (Button, Input, Card, Avatar), 3 temas selecionáveis pelo usuário, aplicação consistente em dashboard e página pública.
5. **Epic 5 — Analytics de Cliques:** tracking server-side de cliques, agregação por link/período, dashboard com totais e gráfico temporal.
6. **Epic 6 — Segurança em Camadas & Hardening:** reintroduzir como unidades didáticas dedicadas os controles de produção deferidos no MVP — RLS em `profiles`/`links`/`link_clicks`, rate limiting em endpoints sensíveis e tracking, middleware edge (auth guard + CSP formal, opcionalmente rewrite `/@username`). Ao final, o produto passa de "funcional" para "publicável em produção aberta".

**Rationale de sequenciamento:**
- Epic 1 estabelece fundação + deploy desde o dia 1 (CI/CD não fica para o fim) e já demonstra valor via canary route — satisfaz "cross-cutting concerns flow through epics".
- Epic 2 entrega auth como primeiro domínio real antes de qualquer feature visível — sem auth, nada mais faz sentido.
- Epic 3 é o **vertical slice** do produto: entrega biolink usável ponta a ponta (ainda que sem estilo nem métricas).
- Epic 4 aplica-se *depois* do produto funcional para evitar design-system-astronaut; primitivos já foram usados de forma rudimentar no Epic 3, agora são formalizados e ganham 3 temas.
- Epic 5 agrega o último pilar funcional (analytics) sobre uma base estável; ao final, o MVP didático está completo e publicável.
- Epic 6 fecha o ciclo como **hardening pós-MVP**: com o produto já funcional, o aprendiz volta a cada ponto de autorização/abuso e promove a defesa em camadas. Separar esse conteúdo permite que cada controle (RLS, rate limit, edge middleware, CSP) ganhe sua própria story com explicação didática completa — e mostra o padrão real de times que entregam MVP primeiro e endurecem depois. Se o escopo comprimir, Epic 6 pode ser reordenado ou fragmentado sem bloquear a entrega do MVP.

---

## 6. Epic Details

### Epic 1 — Fundação & Canary

**Expanded Goal:** Estabelecer toda a infraestrutura do projeto — Next.js 16 com TS strict, Tailwind, dois projetos Supabase Cloud (`production` e `development`), linting/formatação, conventional commits, testes, CI/CD e deploy na Vercel — em um ciclo em que o último entregável é uma URL pública de health-check que confirma que banco, app e pipeline estão operacionais. Nenhuma feature de produto é entregue aqui, mas o aprendiz já vê o fluxo `commit → CI → deploy` funcionando ponta a ponta.

#### Story 1.1 — Inicialização do Next.js 16 com TypeScript strict e Tailwind

Como dev mantenedor,
eu quero inicializar o app Next.js 16 com TS strict e Tailwind configurados,
para que eu tenha base sólida e tipada para todas as próximas stories.

**Acceptance Criteria:**

1. Projeto criado com `create-next-app@latest` (App Router, TS, Tailwind, ESLint, `src/` NÃO, import alias `@/*`), usando Next.js 16.
2. `tsconfig.json` com `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`.
3. `pnpm dev` inicia servidor local em `localhost:3000` e renderiza página inicial sem erros.
4. `pnpm build` roda sem erros.
5. Commit inicial segue conventional commits (`feat: initialize next.js 16 project [Story 1.1]`).

#### Story 1.2 — Linting, formatação e conventional commits

Como dev mantenedor,
eu quero ESLint + Prettier + commitlint configurados com hooks locais,
para que o repositório mantenha qualidade e disciplina didática de commits.

**Acceptance Criteria:**

1. ESLint rodando com config `next/core-web-vitals` + plugin `@typescript-eslint`.
2. Prettier configurado com `.prettierrc` e integração `eslint-config-prettier`.
3. `commitlint` + `husky` instalados; hook `commit-msg` bloqueia mensagens fora do padrão conventional.
4. Scripts `pnpm lint`, `pnpm format`, `pnpm format:check` presentes no `package.json`.
5. `pnpm lint` passa limpo no estado atual do projeto.

#### Story 1.3 — Setup de testes com Vitest

Como dev mantenedor,
eu quero Vitest + React Testing Library configurados,
para que stories posteriores possam incluir testes sem fricção de setup.

**Acceptance Criteria:**

1. Vitest instalado com config para ambiente `jsdom` (componentes) e `node` (helpers/Server Actions).
2. Script `pnpm test` executa suíte; `pnpm test:watch` roda em watch mode.
3. Um teste exemplo em `tests/example.test.ts` valida a infra (`expect(1+1).toBe(2)`).
4. Configuração suporta duas pastas: `tests/unit/` (sem side effects) e `tests/integration/` (conecta ao Supabase `development`).
5. CI (Story 1.5) incluirá `pnpm test` no pipeline.

#### Story 1.4 — Projetos Supabase Cloud e migration baseline

Como dev mantenedor,
eu quero dois projetos Supabase na nuvem (`production` e `development`) e migration baseline versionada,
para que as próximas stories evoluam o schema a partir de uma base controlada, sem dependência de instância local.

**Acceptance Criteria:**

1. Dois projetos criados na conta Supabase do owner: `youtube-biolink-prod` e `youtube-biolink-dev` (região `sa-east-1` se disponível, senão `us-east-1`).
2. Supabase CLI instalada; `supabase init` executado; `supabase/config.toml` commitado.
3. `supabase link` configurado por ambiente (variável `SUPABASE_PROJECT_REF` no `.env.local` do dev aponta para `development`; secret do CI/Vercel para `production`).
4. Migration baseline `supabase/migrations/{ts}_baseline.sql` cria extensões necessárias (`pgcrypto`, `uuid-ossp`) e habilita `pgjwt` se necessário.
5. `supabase db push` aplica baseline com sucesso tanto no projeto `development` quanto `production`.
6. `.env.example` lista `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF` com placeholders e instruções para colar valores do projeto `development`. **`SUPABASE_SERVICE_ROLE_KEY` não entra no MVP** (ver Section 4 — no Epic 6 a variável é adicionada junto com a introdução de RLS).
7. README da raiz atualizado com seção "Setup local" explicando: criar conta Supabase → pedir credenciais do projeto `development` (ou criar próprio) → preencher `.env.local` → rodar `pnpm install` → `pnpm dev`.

#### Story 1.5 — GitHub Actions CI

Como dev mantenedor,
eu quero um workflow de CI que rode typecheck + lint + test + build em todo PR,
para que regressões sejam bloqueadas antes do merge.

**Acceptance Criteria:**

1. Workflow `.github/workflows/ci.yml` dispara em `pull_request` e `push` para `main`.
2. Jobs executam, em ordem: `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`.
3. Integration tests usam secrets `SUPABASE_URL_DEV` e `SUPABASE_ANON_KEY_DEV` configurados em GitHub Secrets; unit tests não requerem credenciais.
4. Cache de pnpm e Next.js configurado para reduzir tempo de execução.
5. CI roda em <5min no estado atual.
6. Branch protection na `main` habilitada exigindo CI verde.

#### Story 1.6 — Deploy automático na Vercel

Como dev mantenedor,
eu quero o projeto conectado à Vercel com deploy automático em `main` e previews em PRs,
para que todo merge gere uma URL pública e todo PR tenha preview para review.

**Acceptance Criteria:**

1. Projeto importado na Vercel, vinculado ao repositório GitHub.
2. Variáveis de ambiente por escopo: Production usa credenciais do projeto Supabase `production`; Preview e Development usam credenciais do projeto Supabase `development`.
3. Merge em `main` gera deploy em URL estável (ex.: `youtube-biolink.vercel.app`) conectado ao banco `production`.
4. PR gera preview URL automaticamente (conectada ao banco `development`), comentada pelo bot da Vercel.
5. Domínio da preview é acessível e serve a build da branch contra o banco `development`.

#### Story 1.7 — Rota canary `/health`

Como dev,
eu quero uma rota pública `/health` que retorne status da conexão com o Supabase,
para que eu tenha evidência ponta a ponta de que a cadeia app ↔ DB ↔ deploy funciona.

**Acceptance Criteria:**

1. Rota `GET /health` implementada como Route Handler em `app/health/route.ts`.
2. Handler executa query trivial no Supabase (ex.: `select now()` via RPC ou direct query) usando client server-side.
3. Resposta JSON: `{ "status": "ok" | "degraded", "db": { "reachable": bool, "latencyMs": number }, "commit": "<sha>", "env": "production" | "development" }`.
4. Em caso de falha de conexão, retorna 503 com `status: "degraded"`.
5. Rota acessível publicamente na Vercel após deploy (em ambas as URLs, production e preview).
6. Teste unitário cobre resposta em sucesso e em falha (mockando client).

#### Story 1.8 — README e estrutura de `docs/stories/`

Como aprendiz clonando o repo,
eu quero um README com instruções de setup local completas e um diretório `docs/stories/` organizado,
para que eu consiga subir o projeto localmente em <15min e encontrar o material didático.

**Acceptance Criteria:**

1. README da raiz inclui: visão do projeto (1 parágrafo), stack, pré-requisitos (Node 20+, pnpm, conta Supabase gratuita), passos de setup (`clone → cp .env.example .env.local → preencher credenciais do projeto Supabase development → pnpm install → pnpm dev`), comandos principais e observação explícita "o projeto não requer Supabase local".
2. Diretório `docs/stories/` existe com README explicando a estrutura `{epic}.{story}.md` e link para o template.
3. Diretório `docs/architecture/` existe (pode estar vazio; será populado pelo @architect).
4. `LICENSE` (MIT) presente na raiz com copyright "Alessandro Varela 2026".
5. Badge de status do CI no topo do README.
6. Setup local validado end-to-end por pelo menos 1 pessoa além do owner, usando credenciais do projeto `development` (registro em PR ou comentário).

---

### Epic 2 — Autenticação & Identidade

**Expanded Goal:** Entregar o domínio de autenticação completo usando Supabase Auth (somente e-mail + senha, sem OAuth no MVP): signup com verificação obrigatória de e-mail, login, logout, reset de senha, sessão persistida por cookies, middleware de proteção de rotas e perfil do usuário editável com username único. Ao final, um usuário real pode criar conta, confirmar e-mail, logar, editar perfil e sair — o dashboard existe como shell autenticado pronto para receber features dos próximos epics.

#### Story 2.1 — Schema `profiles` e trigger de sincronização

Como dev,
eu quero uma tabela `profiles` espelhando `auth.users` via trigger,
para que metadados de usuário (username, nome, bio, avatar, tema) fiquem separados da tabela gerenciada pelo Supabase Auth.

**Acceptance Criteria:**

1. Migration cria tabela `profiles` com: `id uuid PK references auth.users(id) on delete cascade`, `username citext unique not null`, `display_name text`, `bio text check (char_length(bio) <= 160)`, `avatar_url text`, `theme text not null default 'light' check (theme in ('light','dark','accent'))`, `created_at timestamptz default now()`, `updated_at timestamptz`.
2. Índice `unique` em `lower(username)`.
3. Trigger `on auth.users insert` cria linha em `profiles` com `username` derivado do metadata do signup.
4. Trigger `updated_at` atualiza em todo update.
5. Migration aplicada com sucesso no projeto Supabase `development` via `supabase db push`.
6. Teste de integração (rodando contra `development`): inserir em `auth.users` resulta em linha correspondente em `profiles`.

#### Story 2.2 — _(movida para Epic 6.1 na reconciliação v1.1)_

Esta story foi **removida do Epic 2** na reconciliação PRD v1.0 → v1.1 e migrada para o **Epic 6** (ver Story 6.1 — "RLS policies em `profiles`"). O Epic 2 fica com 9 stories (2.1, 2.3–2.10). A numeração original das demais stories é preservada para manter continuidade histórica com commits/PRs que já referenciam esses IDs. No MVP, autorização em `profiles` é application-layer: Server Actions filtram por `id = auth.uid()` em toda escrita; leitura pública (página `/@username`) ocorre via server client sem RLS. Os testes cross-user de autorização continuam existindo — mas validam o comportamento via Server Action, não policies de banco.

#### Story 2.3 — Lista de usernames reservados e validação

Como dev,
eu quero validação de username contra lista de reservados e regras de formato,
para que usernames como `admin`, `api`, `dashboard` não sejam registráveis por usuários.

**Acceptance Criteria:**

1. Helper `lib/validation/username.ts` com função `validateUsername(u: string): Result<void, UsernameError>`.
2. Regras: 3-30 caracteres, regex `^[a-z0-9_]+$` (lowercase após normalização), não pode começar com `_` ou número.
3. Lista reservada hardcoded: `admin`, `api`, `auth`, `dashboard`, `help`, `login`, `logout`, `settings`, `signup`, `reset-password`, `health`, `_next`, `favicon.ico`, `robots.txt`, `sitemap.xml`.
4. Função é pura (sem acesso DB) e testável.
5. Testes unitários cobrem: happy path, todos os tipos de erro, normalização (username uppercase é aceito e normalizado para lowercase antes de validar).

#### Story 2.4 — Signup com e-mail, senha e username

Como novo usuário,
eu quero me cadastrar com e-mail, senha e username,
para que eu tenha minha página pública reservada.

**Acceptance Criteria:**

1. Página `/signup` com form: e-mail, senha (min 8 chars), confirmação de senha, username.
2. Validação client + server (`zod` + helper da Story 2.3); username checado contra duplicatas no DB.
3. Server Action chama `supabase.auth.signUp()` passando `options.data.username`.
4. Trigger da Story 2.1 cria `profile` com username informado.
5. Supabase Auth envia e-mail de verificação; página redireciona para `/signup/check-email` com instrução clara.
6. _(deferido para Epic 6)_ Rate limiting de signup (5/h/IP) é endereçado na Story 6.4 — não aplicável no MVP.
7. Username duplicado retorna erro claro no form, sem criar usuário em `auth.users`.
8. Teste de integração (contra `development`): signup → registro em `auth.users` + `profiles`.

#### Story 2.5 — Confirmação de e-mail

Como novo usuário,
eu quero confirmar meu e-mail via link recebido,
para que minha conta fique ativada e eu possa fazer login.

**Acceptance Criteria:**

1. Route Handler `/auth/callback` processa token enviado pelo Supabase Auth.
2. Sucesso redireciona para `/login?confirmed=1` com mensagem de sucesso.
3. Token inválido ou expirado redireciona para `/auth/confirm-failed` com opção de reenvio.
4. E-mail template do Supabase Auth customizado (subject + body) em pt-BR, configurado tanto em `development` quanto em `production`.
5. Reenvio de e-mail de verificação disponível via botão em `/signup/check-email`.

#### Story 2.6 — Login com credenciais e sessão

Como usuário com conta verificada,
eu quero logar com e-mail e senha,
para que eu acesse meu dashboard autenticado.

**Acceptance Criteria:**

1. Página `/login` com form: e-mail, senha, link "esqueci minha senha".
2. Server Action chama `supabase.auth.signInWithPassword()`.
3. Sessão persiste via cookies server-side (usando `@supabase/ssr`).
4. Sucesso redireciona para `/dashboard`.
5. Credenciais inválidas ou conta não-verificada retornam erro genérico (não vazar qual é o problema — segurança).
6. _(deferido para Epic 6)_ Rate limiting de login (10 tentativas/15min/IP) é endereçado na Story 6.4 — não aplicável no MVP.
7. Teste de integração (contra `development`): login válido → cookie de sessão presente.

#### Story 2.7 — Reset de senha

Como usuário que esqueceu a senha,
eu quero solicitar um link de reset por e-mail e definir nova senha,
para que eu recupere acesso à minha conta.

**Acceptance Criteria:**

1. Página `/reset-password` (request): form com e-mail; chama `supabase.auth.resetPasswordForEmail()`.
2. Supabase envia e-mail com link para `/reset-password/confirm?token=...`.
3. Página `/reset-password/confirm`: form com nova senha + confirmação; chama `supabase.auth.updateUser({password})`.
4. Sucesso redireciona para `/login?reset=1`.
5. Tokens inválidos/expirados exibem erro com opção de nova solicitação.
6. _(deferido para Epic 6)_ Rate limiting de reset (3 requests/h/IP) é endereçado na Story 6.4 — não aplicável no MVP.
7. E-mail template customizado em pt-BR.

#### Story 2.8 — Logout

Como usuário autenticado,
eu quero deslogar,
para que minha sessão seja encerrada.

**Acceptance Criteria:**

1. Botão "Sair" no dashboard dispara Server Action que chama `supabase.auth.signOut()`.
2. Cookies de sessão são invalidados.
3. Redireciona para `/` (landing ou login).
4. Tentar acessar `/dashboard` após logout redireciona para `/login`.

#### Story 2.9 — Middleware de proteção de rotas

Como dev,
eu quero middleware Next.js que proteja `/dashboard/*` e redirecione visitantes anônimos,
para que rotas autenticadas sejam inacessíveis sem sessão.

**Acceptance Criteria:**

1. Arquivo `middleware.ts` na raiz; matcher inclui `/dashboard/:path*`.
2. Middleware verifica cookie de sessão via `@supabase/ssr` helper server-side.
3. Sem sessão → redirect 307 para `/login?next={pathname}`.
4. Com sessão → `NextResponse.next()`.
5. Middleware também refresca access token quando próximo de expirar.
6. Teste de integração cobrindo: rota protegida sem cookie retorna redirect; com cookie válido retorna 200.

#### Story 2.10 — Dashboard de perfil editável

Como usuário autenticado,
eu quero editar meu nome de exibição, bio e URL de avatar no dashboard,
para que minha página pública reflita meu perfil.

**Acceptance Criteria:**

1. Página `/dashboard` (default route) mostra form com: `display_name`, `bio` (textarea, contador 0/160), `avatar_url`.
2. Server Action `updateProfile` valida com `zod` (bio ≤160, `avatar_url` http(s) válida se preenchida) e persiste em `profiles`.
3. Validação impede sobrescrever campos de outros users (RLS + filter por `auth.uid()`).
4. Feedback inline: toast "Perfil atualizado" em sucesso; erros de validação inline no campo.
5. Avatar URL preview exibido ao lado do form (fallback para placeholder se URL inválida ou 404).
6. Username **não** é editável no MVP (documentar como débito para Phase 2).
7. Teste unitário da validação `zod` + teste de integração da Server Action.

---

### Epic 3 — Links & Página Pública

**Expanded Goal:** Entregar o core do produto: usuário autenticado gerencia seus links no dashboard (criar, editar, deletar, reordenar por drag-and-drop, ativar/desativar) e a página pública `/@username` renderiza via SSR (RSC) os links ativos na ordem definida. Sanitização de URLs e tratamento de 404 fazem parte desta entrega. Ao final do Epic 3, o produto é **publicável e funcional** mesmo sem design system formal e sem analytics.

#### Story 3.1 — Schema `links`

Como dev,
eu quero uma tabela `links` com DDL e índices adequados,
para que usuários tenham onde gravar seus links e a página pública consiga lê-los.

**Acceptance Criteria:**

1. Migration cria tabela `links` com: `id uuid PK default gen_random_uuid()`, `profile_id uuid not null references profiles(id) on delete cascade`, `title text not null check (char_length(title) between 1 and 60)`, `url text not null`, `position int not null default 0`, `is_active boolean not null default true`, `created_at timestamptz default now()`, `updated_at timestamptz`.
2. Índice em `(profile_id, position)` para ordenação.
3. _(deferido para Epic 6)_ RLS e policies (`links_select_public_active`, `links_select_own`, `links_insert_own`, `links_update_own`, `links_delete_own`) são endereçadas na Story 6.2. No MVP, autorização é application-layer: Server Actions filtram por `profile_id = auth.uid()`; leitura pública filtra por `is_active = true` no próprio query.
4. Trigger de `updated_at`.
5. Migration aplicada com sucesso em `development` via `supabase db push`.
6. Teste de integração valida via Server Action: usuário A não consegue UPDATE/DELETE em link de usuário B (o filtro por `auth.uid()` rejeita a operação); query pública da página `/@username` retorna apenas links `is_active = true` do profile correto.

#### Story 3.2 — Helper de sanitização de URL

Como dev,
eu quero um helper puro que valide e sanitize URLs de link,
para que schemes perigosos nunca cheguem ao DB.

**Acceptance Criteria:**

1. `lib/validation/url.ts` exporta `sanitizeLinkUrl(input: string): Result<string, UrlError>`.
2. Aceita apenas `http://` e `https://`.
3. Rejeita (com erro tipado): `javascript:`, `data:`, `vbscript:`, `file:`, URLs sem scheme, strings vazias, URLs malformadas.
4. Normaliza URL (trim, decode padrão, preserva query e fragment).
5. Testes cobrem cada caso (≥15 asserts) incluindo obfuscation (`JaVaScRiPt:`, com espaço/tab no começo, etc.).

#### Story 3.3 — CRUD de links no dashboard

Como usuário autenticado,
eu quero criar, listar, editar e deletar meus links,
para que eu componha minha página pública.

**Acceptance Criteria:**

1. Página `/dashboard/links` lista links do usuário ordenados por `position`.
2. Form inline no topo para criar link: `title`, `url` (usa helper da Story 3.2).
3. Cada link na lista tem: campos editáveis inline, toggle `is_active`, botão deletar (com confirmação).
4. Server Actions: `createLink`, `updateLink`, `deleteLink`, `toggleActive` — todas validadas com `zod` + helper de URL.
5. Limite: máximo 30 links por usuário (retorna erro claro ao criar 31º).
6. Feedback inline em sucesso/erro; optimistic updates onde seguro (criar, toggle).
7. Testes unitários das Server Actions (mockando client Supabase) + teste de integração contra `development`.

#### Story 3.4 — Reordenação de links via drag-and-drop

Como usuário autenticado,
eu quero arrastar meus links para reordenar,
para que eu controle a sequência exibida na página pública.

**Acceptance Criteria:**

1. Lista da Story 3.3 ganha handle de drag em cada item usando `@dnd-kit/core`.
2. Drop reordena visualmente (optimistic); Server Action `reorderLinks` persiste nova ordem (update em lote de `position`).
3. Alternativa keyboard-accessible: botões "↑" e "↓" em cada item (não requer screen reader test formal, mas focus trap e aria-labels corretos).
4. Teste de integração: reordenação persiste corretamente mesmo com 20+ links.
5. Latência perceptível de reordenação <200ms em rede típica.

#### Story 3.5 — Página pública `/@username` via SSR

Como visitante,
eu quero acessar `/@username` sem login e ver a página pública do usuário,
para que eu clique nos links que me interessam.

**Acceptance Criteria:**

1. Rota `app/@[username]/page.tsx` (ou `app/[username]/page.tsx` com prefix `@` tratado) renderiza via RSC.
2. Query busca `profile` por `username` (case-insensitive) + links ativos ordenados por `position`.
3. Renderização inclui: avatar (com fallback), display_name, bio, lista de links ativos.
4. Links abrem em nova aba com `rel="noopener noreferrer"`.
5. Username inexistente retorna 404 (via `notFound()` do Next) com página de erro custom `not-found.tsx`.
6. Meta tags: `<title>{display_name} (@{username})</title>`, `description={bio}`, OG image placeholder (definitivo em Phase 2).
7. Cache: `revalidate = 60` na página ou `cache-control: s-maxage=60, stale-while-revalidate=300`.
8. Validação manual do fluxo completo documentada em comentário do PR (smoke test consolidado vive na Story 5.6).

#### Story 3.6 — Tratamento de URL com caractere `@` e reserved routes

Como dev,
eu quero que o roteamento da página pública não conflite com rotas internas reservadas,
para que `/login`, `/dashboard`, `/signup`, etc. continuem funcionando.

**Acceptance Criteria:**

1. Estrutura de rotas escolhida ([@architect decide entre `/@[username]` ou prefix path]) garante ausência de ambiguidade.
2. Nomes reservados (Story 2.3) não podem ser registrados como username.
3. Acessar `/dashboard` mesmo como username técnico não conflita com rota interna.
4. Documentar decisão em `docs/architecture/routing.md`.

---

### Epic 4 — Design System & Temas

**Expanded Goal:** Formalizar o design system que durante Epics 2-3 foi construído de forma tática: tokens consolidados, primitivos reutilizáveis (Button, Input, Textarea, Card, Avatar), 3 temas via CSS variables selecionáveis pelo usuário, e aplicação consistente em dashboard e página pública. Inclui acessibilidade WCAG AA validada e documentação viva leve (arquivo markdown descrevendo cada primitivo + MDX opcional).

#### Story 4.1 — Design tokens e CSS variables

Como dev,
eu quero tokens de design (cores, spacing, typography, radius) definidos como CSS variables e integrados ao Tailwind,
para que temas possam alterar a aparência sem modificar componentes.

**Acceptance Criteria:**

1. `app/globals.css` define CSS variables para: `--color-bg`, `--color-fg`, `--color-muted`, `--color-accent`, `--color-accent-fg`, `--color-border`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--font-sans`.
2. `tailwind.config.ts` consome variables via `theme.extend.colors` com `bg: 'var(--color-bg)'` etc.
3. Tema default (`light`) aplicado no `:root`; `.theme-dark` e `.theme-accent` redefinem tokens.
4. Aplicação mínima: background, foreground e accent visualmente distintos entre temas.
5. Teste visual manual documentado em story (screenshots nos 3 temas).

#### Story 4.2 — Primitivos UI

Como dev,
eu quero primitivos acessíveis (Button, Input, Textarea, Card, Avatar, Label),
para que páginas componham interface consistente e a11y-compliant.

**Acceptance Criteria:**

1. Componentes em `components/ui/`: `Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Card.tsx`, `Avatar.tsx`, `Label.tsx`, `Toast.tsx`.
2. Button: variants `primary`, `secondary`, `ghost`, `destructive`; sizes `sm`, `md`, `lg`; `disabled` + loading spinner.
3. Input/Textarea: `label`, `error`, `hint` como props; estados de erro visíveis e com `aria-invalid`.
4. Avatar: fallback (iniciais do `display_name`) quando `src` ausente ou 404.
5. Toast: posicionamento `top-right`, auto-dismiss 5s, acessível (`role="status"` ou `role="alert"` conforme severidade).
6. Cada primitivo tem teste unitário (render + estado básico).
7. Páginas de dashboard e auth migradas para usar os primitivos (refactor leve, não reescrever do zero).

#### Story 4.3 — Seletor de tema persistido no perfil

Como usuário autenticado,
eu quero escolher entre light/dark/accent no dashboard,
para que minha escolha reflita em todas as páginas que me representam.

**Acceptance Criteria:**

1. Card "Aparência" em `/dashboard` exibe 3 swatches clicáveis (preview visual de cada tema).
2. Clicar em swatch dispara Server Action `updateTheme` que persiste em `profiles.theme`.
3. Aplicação instantânea no dashboard (class no `<html>` ou `<body>` via `ThemeProvider` client-side).
4. Tema escolhido é lido server-side na página pública `/@username` e aplicado no SSR (sem FOUC).
5. Fallback `light` se valor inválido no DB (defense in depth, apesar do CHECK constraint).
6. Teste de integração: update de tema → reflete ao recarregar página pública.

#### Story 4.4 — Aplicação consistente de tema

Como visitante da página pública,
eu quero que o tema do dono da página seja aplicado,
para que a identidade visual do criador se preserve.

**Acceptance Criteria:**

1. Página `/@username` lê `profile.theme` e injeta a classe correspondente no root da página (server-side).
2. CSS variables resolvem para os valores do tema escolhido sem flash.
3. Contraste WCAG AA validado em cada um dos 3 temas (ferramenta: `axe-core` rodado manualmente ou em CI leve).
4. Dashboard aplica o mesmo tema do usuário logado (não fixa no light).
5. Toggle de tema em `/dashboard/appearance` (ou card na home do dashboard) funciona sem reload.

#### Story 4.5 — Documentação viva do design system

Como aprendiz,
eu quero um documento descrevendo cada token, primitivo e tema,
para que eu entenda as decisões do design system e consiga replicar em outros projetos.

**Acceptance Criteria:**

1. Arquivo `docs/design-system.md` em pt-BR documenta: tokens (tabela), primitivos (exemplo de uso de cada um), 3 temas (screenshots + quando usar), a11y checks rodados.
2. Seção "Decisões" registra por que Tailwind + CSS variables vs. outras abordagens (CSS Modules, vanilla-extract, styled-components).
3. Link do design-system.md no README.
4. Opcional (stretch): playground MDX em `/dev/ui` atrás de flag `NEXT_PUBLIC_UI_PLAYGROUND=1` (não obrigatório para DoD).

---

### Epic 5 — Analytics de Cliques

**Expanded Goal:** Entregar o último pilar didático do MVP — analytics — com tracking server-side de cliques em links, agregação eficiente e dashboard de métricas por link e por período. Mantém privacidade (sem IP raw, UA truncado). Rate limiting do tracking é tratado no **Epic 6 (Story 6.4)** como unidade didática dedicada; no MVP, o tracking é fire-and-forget via Server Action sem throttling ativo. Ao final do Epic 5, o produto está **funcionalmente completo** e demonstra os 6 pilares integrados.

#### Story 5.1 — Schema `link_clicks`

Como dev,
eu quero uma tabela `link_clicks` append-only com DDL e índices adequados,
para que cliques sejam registrados e agregáveis por link/período.

**Acceptance Criteria:**

1. Migration cria tabela `link_clicks` com: `id uuid PK default gen_random_uuid()`, `link_id uuid not null references links(id) on delete cascade`, `clicked_at timestamptz not null default now()`, `user_agent_hash text` (opcional, hash SHA-256 truncado de 16 chars), `user_agent_short text check (char_length(user_agent_short) <= 120)`.
2. Índice em `(link_id, clicked_at desc)`.
3. _(deferido para Epic 6)_ RLS e policies (INSERT, SELECT, UPDATE/DELETE) são endereçadas na Story 6.3. No MVP, `link_clicks` fica **sem RLS**: INSERT ocorre via Server Action usando o client server-side (sem SERVICE_ROLE); SELECT ocorre apenas via Server Action que filtra por links do `auth.uid()`; a autorização é application-layer.
4. Sem coleta de IP raw nem UA completo.
5. Migration aplicada em `development` via `supabase db push`; teste de integração valida via Server Action que usuário A não enxerga cliques de links de usuário B (filtro por `auth.uid()` em SELECT).

#### Story 5.2 — Server Action de tracking de clique

Como dev,
eu quero uma Server Action que registre clique no link,
para que a página pública dispare tracking sem expor endpoint público cru.

**Acceptance Criteria:**

1. `app/actions/track-click.ts` exporta `trackLinkClick(linkId: string)`.
2. Valida que `linkId` existe e `is_active = true` antes de inserir (evita lixo).
3. Insere em `link_clicks` usando o client server-side padrão (`createServerClient`). **Sem SERVICE_ROLE no MVP** — como `link_clicks` não tem RLS nesta fase (ver Story 5.1 AC3), INSERT direto funciona. Quando o Epic 6 introduzir RLS em `link_clicks` (Story 6.3), esta Server Action será refatorada para usar `security definer` ou admin client, conforme decisão do @architect.
4. Trunca UA a 120 chars; hash opcional para deduplicação futura (stretch).
5. _(deferido para Epic 6)_ Rate limiting (60 cliques/linkId/IP/min) é endereçado na Story 6.4 — não aplicável no MVP.
6. Retorna `{ ok: true }` ou erro tipado; não lança exceção para client (sempre resposta graceful).
7. Testes unitários (mock Supabase) e integração contra `development`.

#### Story 5.3 — Tracking disparado na página pública

Como visitante,
eu quero que meus cliques em links sejam registrados automaticamente,
para que o criador da página tenha métricas.

**Acceptance Criteria:**

1. Página `/@username` envolve cada link em um componente client que intercepta o `onClick` e dispara a Server Action antes de navegar.
2. Navegação não é bloqueada se tracking falhar (fire-and-forget com `sendBeacon`-like pattern em client).
3. Acessibilidade: link ainda é um `<a href>` válido; `Ctrl+Click`, middle-click e keyboard funcionam normalmente.
4. Teste manual: clique registra linha em `link_clicks`; navegação ocorre mesmo com tracking offline simulado.

#### Story 5.4 — Agregação de cliques (view/query helpers)

Como dev,
eu quero views/queries otimizadas para agregação de cliques por link e por dia,
para que o dashboard renderize rápido mesmo com muitos cliques.

**Acceptance Criteria:**

1. Migration cria view `link_click_daily` materializada (ou regular) agregando `count(*)` por `(link_id, date_trunc('day', clicked_at))`.
2. Helper `lib/analytics/clicks.ts` expõe: `getClicksByLink(profileId)` (total por link) e `getDailyClicks(profileId, days)` (series por dia).
3. Query usa índices e respeita RLS (profile_id filter via join).
4. Benchmark documentado em story: 10k cliques seeded no `development`, query <100ms.
5. Testes de integração com seed de dados.

#### Story 5.5 — Dashboard de analytics

Como usuário autenticado,
eu quero ver total de cliques por link e um gráfico de cliques por dia,
para que eu entenda o engajamento da minha página pública.

**Acceptance Criteria:**

1. Página `/dashboard/analytics` lista links com colunas: título, total de cliques (acumulado), últimos 7 dias, últimos 30 dias.
2. Gráfico de linha simples (biblioteca escolhida pelo @architect) mostra cliques por dia nos últimos 30 dias (agregado, todos os links).
3. Período seletivo: toggle entre 7/30/90 dias.
4. Estado vazio ("nenhum clique ainda") com cópia amigável e CTA para compartilhar a página.
5. Loading state com skeleton.
6. Acessibilidade: tabela com `<caption>`, gráfico com tabela alternativa ou `aria-label` descritivo.
7. Teste unitário dos helpers de agregação.

#### Story 5.6 — Revisão final: smoke test manual e merge MVP

Como product manager,
eu quero validar o fluxo completo de signup → criar links → página pública → clicar → ver analytics,
para que eu declare o MVP entregue conforme critérios de sucesso.

**Acceptance Criteria:**

1. Checklist de smoke test **manual** executado (E2E automatizado está explicitamente fora de escopo):
   1. Criar conta + confirmar e-mail (mailbox de teste).
   2. Logar, editar perfil, escolher tema `accent`.
   3. Criar 3 links, reordenar, desativar um.
   4. Acessar página pública em outro browser (anônimo).
   5. Clicar em 2 dos links.
   6. Voltar ao dashboard, verificar analytics refletindo os 2 cliques.
2. Smoke test manual documentado em `docs/smoke-test.md` para reuso futuro (roteiro passo a passo, não script automatizado).
3. README atualizado com checklist de "O MVP está pronto quando…" (conforme NFR17 e goals).
4. 3 devs externos reproduzem o setup local (apontando ao projeto Supabase `development` ou próprio) — registros em issues ou discussion GitHub.
5. Release `v0.1.0` taggeada na `main`; Change Log do PRD promovido para `1.0`.

---

### Epic 6 — Segurança em Camadas & Hardening

**Expanded Goal:** Reintroduzir, como unidades didáticas dedicadas, os controles de produção deferidos no MVP. Cada story é um capítulo isolado: o aprendiz vê o produto funcionando sem o controle, entende o risco concreto, e adiciona a camada de defesa. Ao final do Epic 6: (a) toda tabela multi-tenant tem **RLS habilitada** com policies explícitas que replicam a autorização da app-layer como defense-in-depth; (b) endpoints sensíveis e tracking têm **rate limiting** ativo; (c) proteção de rotas migra para **middleware edge** com **CSP formal**; (d) a Server Action de tracking de clique é refatorada para operar com a RLS ativa. O produto passa de "funcional" para "publicável em produção aberta". Escopo e ACs finais de cada story serão detalhados pelo @sm via `*draft` quando o Epic 5 estiver próximo do fim — esta seção define apenas o contrato estrutural.

**Pré-requisitos:** Epics 1–5 entregues (MVP funcional em produção). Epic 6 **não** bloqueia a declaração de MVP pronto.

#### Story 6.1 — RLS policies em `profiles`

Como dev,
eu quero RLS policies garantindo que cada usuário só leia/escreva o próprio perfil (exceto leitura pública de campos não-sensíveis),
para que dados de perfil fiquem protegidos no nível do banco (defense-in-depth).

**Origem:** migrada da antiga Story 2.2 (Epic 2 na v1.0 do PRD) sem mudanças estruturais nas policies.

**Acceptance Criteria (esboço — detalhamento final pelo @sm):**

1. RLS habilitado em `profiles`.
2. Policy `profiles_select_public`: anon e authenticated podem SELECT em campos públicos (`username`, `display_name`, `bio`, `avatar_url`, `theme`) com `USING (true)`.
3. Policy `profiles_update_own`: authenticated só UPDATE em `id = auth.uid()`.
4. Policy `profiles_insert_own`: apenas via trigger do sistema; insert direto de client bloqueado.
5. Policy `profiles_delete_own`: usuário pode deletar apenas próprio perfil.
6. Server Actions de profile podem (decisão do @dev) manter ou remover o filter defensivo por `auth.uid()` — belt-and-suspenders é aceitável, a intenção didática é tornar o RLS a fonte da verdade.
7. Teste de integração (contra `development`) valida: user A não consegue UPDATE/DELETE em perfil de user B via client autenticado direto no Supabase (não apenas via Server Action).

#### Story 6.2 — RLS policies em `links`

Como dev,
eu quero RLS policies em `links` cobrindo leitura pública de ativos e CRUD restrito ao dono,
para que a autorização do dashboard e da página pública passe a viver no banco.

**Origem:** migrada da antiga Story 3.1 AC3 (Epic 3 na v1.0 do PRD).

**Acceptance Criteria (esboço):**

1. RLS habilitado em `links`.
2. Policy `links_select_public_active`: any role pode SELECT onde `is_active = true` (página pública).
3. Policy `links_select_own`: authenticated SELECT onde `profile_id = auth.uid()`.
4. Policies `links_insert_own`, `links_update_own`, `links_delete_own`: restritas a `profile_id = auth.uid()`.
5. Teste de integração valida: user A não consegue UPDATE/DELETE link de user B via client autenticado direto; query pública não retorna `is_active = false`.
6. Opcional (stretch): remover filters defensivos das Server Actions de links agora que a RLS garante o isolamento.

#### Story 6.3 — RLS em `link_clicks` + refactor da Server Action de tracking

Como dev,
eu quero RLS em `link_clicks` e a Server Action `trackLinkClick` refatorada para operar sob a nova política,
para que analytics fiquem protegidas em camadas (app + banco) sem perder a capacidade de registrar clique do visitante anônimo.

**Origem:** migrada da antiga Story 5.1 AC3 (Epic 5 na v1.0 do PRD), combinada com refactor da Story 5.2.

**Acceptance Criteria (esboço):**

1. RLS habilitado em `link_clicks`.
2. INSERT de cliques: implementado via **função `security definer`** chamada por RPC na Server Action (preferido) OU via `createAdminClient` com SERVICE_ROLE encapsulado em helper (alternativa). @architect decide no início do Epic 6.
3. Policy de SELECT: usuário SELECT clicks apenas para links cujo `profile_id = auth.uid()` (via join ou subquery).
4. UPDATE/DELETE bloqueados para todos os roles (exceto admin/DBA).
5. Server Action `trackLinkClick` (Story 5.2) refatorada para usar a estratégia escolhida em AC2.
6. Dashboard de analytics (Story 5.5) continua funcionando sem mudanças de UX perceptíveis.
7. Teste de integração valida: user A não enxerga linhas de `link_clicks` de links de user B via client autenticado direto; INSERT anônimo continua funcionando via tracking público.

#### Story 6.4 — Rate limiting (signup + login + reset + tracking)

Como dev,
eu quero rate limiting ativo em endpoints sensíveis e no tracking de clique,
para que o produto resista a abuso básico de automação sem sacrificar UX legítima.

**Origem:** consolidada das ACs removidas das stories 2.4 AC6, 2.6 AC6, 2.7 AC6 e 5.2 AC5 (v1.0 do PRD).

**Acceptance Criteria (esboço):**

1. Estratégia técnica decidida pelo @architect (ex.: Supabase-native via RPC + tabela `rate_limits`, Upstash, Vercel KV). Decisão documentada em `docs/architecture/rate-limiting.md`.
2. Signup: máximo 5 por IP/h.
3. Login: máximo 10 tentativas por IP/15min.
4. Reset de senha: máximo 3 requests por IP/h.
5. Tracking de clique: máximo 60 por `linkId` por IP/min.
6. Respostas `429 Too Many Requests` com `Retry-After` header e mensagem em pt-BR.
7. Testes de integração cobrem hit do limite e recuperação após janela.

#### Story 6.5 — Middleware edge: auth guard unificado + CSP formal

Como dev,
eu quero substituir o auth guard de layout por middleware edge e aplicar CSP formal,
para que a proteção de rotas rode no edge (latência mínima) e o produto tenha headers de segurança adequados.

**Escopo:**

1. Substituir layout-based guard (MVP) por `middleware.ts` na raiz com matcher `/dashboard/:path*`.
2. Refresh de access token quando próximo de expirar.
3. **CSP formal** (`default-src 'self'`, `img-src` com allowlist, `connect-src` incluindo `*.supabase.co`, `script-src` sem `unsafe-*` em produção). Documentar trade-offs.
4. HSTS + `X-Content-Type-Options: nosniff` + `Referrer-Policy: strict-origin-when-cross-origin` configurados.
5. _(opcional / stretch)_ Rewrite `/@username` → `/[username]` via middleware se brand URL virar prioridade (hoje a arquitetura v0.3 resolve via `app/[username]` + reserved list sem rewrite).
6. Testes de integração validam: rota protegida sem cookie retorna redirect; com cookie válido retorna 200; headers de segurança presentes em resposta.

---

## 7. Checklist Results Report

**Avaliação executada contra `.aiox-core/product/checklists/pm-checklist.md` (modo comprehensive).**

### Executive Summary

- **Completude do PRD:** ~93% (pós-reconciliação v1.1).
- **Adequação do MVP scope:** **Just Right** — escopo enxuto, cada feature amarrada a pilar didático; cortes realistas (OAuth, upload, domínios, billing, E2E automatizado, Supabase local) bem documentados. Na v1.1, controles de produção (RLS, rate limiting, middleware edge, CSP) migraram para o **Epic 6 (Hardening)** pós-MVP — alinhado ao princípio "simplificar camadas, não paradigmas" da arquitetura v0.3.
- **Prontidão para fase de implementação:** **Ready** — Story 1.1 é scaffolding puro e não depende da reconciliação; @sm pode iniciar.
- **Lacunas críticas:** nenhuma bloqueante. HIGH items H1/H2/H4 resolvidos pela arquitetura v0.3; H3 (rate limiting) foi deliberadamente deferido para o Epic 6 e deixa de ser gap.

### Category Analysis

| Category                           | Status  | Critical Issues                                                                                        |
|------------------------------------|---------|--------------------------------------------------------------------------------------------------------|
| 1. Problem Definition & Context    | PASS    | KPIs de "GitHub stars" permanecem sem meta numérica (intencional — sinal secundário).                   |
| 2. MVP Scope Definition            | PASS    | Validação "3 devs externos reproduzem" exige operacionalização (ver Story 5.6).                        |
| 3. User Experience Requirements    | PASS    | Wireframes detalhados serão entregues pelo @ux-design-expert — não é responsabilidade do PRD.           |
| 4. Functional Requirements         | PASS    | 24 FRs cobrem 6 pilares; cada FR testável e atrelado a story.                                           |
| 5. Non-Functional Requirements     | PASS    | 20 NFRs; NFR3 (RLS) e NFR18 (rate limiting) reformulados na v1.1 como objetivos de Epic 6; cobertura de testes com meta quantificada.               |
| 6. Epic & Story Structure          | PASS    | 6 epics sequenciais (5 de MVP + 1 de hardening), ~40 stories em pt-BR; Epic 1 inclui scaffold + CI + deploy + canary; Epic 6 separa produção-grade como unidade didática pós-MVP.              |
| 7. Technical Guidance              | PASS    | Stack travada (Next.js 16, Supabase cloud-only) com rationale; decisões críticas marcadas.             |
| 8. Cross-Functional Requirements   | PARTIAL | Schemas de DB descritos no nível de story; modelo ER consolidado ficará com @data-engineer.             |
| 9. Clarity & Communication         | PASS    | Documento em pt-BR (inclusive stories), estrutura consistente, terminologia uniforme, change log atualizado para v1.1.  |

### Top Issues by Priority

- **BLOCKERS:** nenhum.
- **HIGH (todos resolvidos ou deliberadamente deferidos na v1.1 pós-arquitetura v0.3):**
  - **H1 — RESOLVIDO (arquitetura v0.3):** roteamento adotado é `app/[username]` + reserved list, sem middleware rewrite no MVP. Story 3.6 permanece como documentação da decisão.
  - **H2 — RESOLVIDO (arquitetura v0.3):** biblioteca de gráficos escolhida é Recharts; trade-off de bundle registrado na arquitetura.
  - **H3 — DEFERIDO para Epic 6:** rate limiting sai do MVP; estratégia técnica (Supabase-native via RPC, Upstash, Vercel KV) será decidida na Story 6.4 pelo @architect. Deixa de ser gap do PRD.
  - **H4 — RESOLVIDO (arquitetura v0.3):** isolamento em CI adotado é *unique-user per test* + *CI concurrency guard*; política documentada na arquitetura.
- **MEDIUM:**
  - **M1** — Templates de e-mail Supabase em pt-BR (Story 2.5, 2.7) precisam ser produzidos como artefato visual, não só descritos — e aplicados em ambos os projetos cloud.
  - **M2** — Critério "3 devs externos reproduzem" (Story 5.6) depende de divulgação mínima; plano de recrutamento não está no MVP.
  - **M3** — @data-engineer deve produzir ER diagram consolidado antes do Epic 3 (input para stories 3.1, 5.1).
- **LOW:**
  - **L1** — Playground MDX de UI (Story 4.5 stretch) é "nice to have" sem DoD formal.
  - **L2** — Observabilidade estruturada (logs/traces) está em Phase 2, mas Server Actions críticas merecem console.error com contexto desde o MVP.

### MVP Scope Assessment

- **Features potencialmente cortáveis** para MVP mais enxuto: Analytics completo (Epic 5) poderia virar Phase 2 mantendo só tracking de clique sem dashboard — porém isso amputa o pilar didático "Analytics", que é explícito nos goals. **Manter.**
- **Missing essenciais:** nenhum identificado; os 6 pilares estão cobertos no MVP (Epics 1–5); pilar de segurança em camadas aprofundado no Epic 6 pós-MVP.
- **Complexidade:** drag-and-drop acessível (Story 3.4) e isolamento de dados em integration tests contra cloud compartilhado (H4 — resolvido na arquitetura v0.3) são as áreas que demandam maior atenção. RLS multi-tenant deixa o MVP e se torna a espinha do Epic 6 (stories 6.1, 6.2, 6.3).
- **Realismo do timeline:** N/A (sem deadline); entrega por DoD. Epic 6 é opcionalmente sequenciado após o MVP declarado pronto.

### Technical Readiness

- **Clareza das constraints:** alta — stack (Next.js 16, Supabase cloud-only), versões, free tier, licença, idioma, escopo de testes (sem E2E) e assumptions adicionais explícitas; arquitetura v0.3 consolidada com DDL e decisões HIGH resolvidas.
- **Riscos técnicos identificados:** drag-and-drop acessível (mitigado via `@dnd-kit/core` na Story 3.4); FOUC de tema na página pública (mitigado na Story 4.4); dependência de app-layer para autorização no MVP (mitigada por Epic 6 como hardening dedicado e por testes via Server Action).
- **Áreas para @architect na entrada do Epic 6:** (a) estratégia de INSERT em `link_clicks` sob RLS (`security definer` vs. admin client); (b) backing store de rate limiting compatível com free tier; (c) CSP formal e trade-offs.

### Recommendations

1. Owner aprova PRD v1.1; @architect promove `docs/architecture.md` para `v1.0`.
2. @ux-design-expert executa `*front-end-spec` em paralelo (não bloqueado pela reconciliação).
3. @sm inicia `*draft 1.1` (scaffolding Next.js 16); Epic 1 não depende da reconciliação.
4. Quando Epic 5 estiver próximo do fim, @sm faz `*draft` das stories 6.1–6.5 com ACs detalhadas.

### Final Decision

**READY FOR IMPLEMENTATION** — PRD v1.1 reconciliado com arquitetura v0.3; @sm pode iniciar Story 1.1. Epic 6 fica como compromisso estrutural pós-MVP, com contrato mínimo definido e detalhamento delegado ao @sm quando o momento chegar.

---

## 8. Next Steps

### UX Expert Prompt

> **@ux-design-expert (Uma)** — este PRD (`docs/prd.md` v1.1) e a arquitetura (`docs/architecture.md` v0.3) definem as 9 core screens do MVP (Signup, Confirm-Email, Login, Reset-Password, Dashboard-Perfil, Dashboard-Links, Dashboard-Analytics, Página Pública `/@username`, 404). Por favor, entregue wireframes low-fi mobile-first + desktop para cada uma, respeitando: (1) 3 temas pré-definidos com tokens CSS variables, (2) WCAG AA, (3) drag-and-drop com alternativa keyboard (Story 3.4), (4) estados vazio/loading/erro em cada tela. Saída esperada em `docs/frontend-spec.md` + referências visuais. Stack fixada: Next.js 16 + Tailwind + shadcn/ui como base. Use `*front-end-spec` para iniciar. **Não bloqueado** pela reconciliação v1.1 — pode começar em paralelo.

### Architect Prompt (Epic 6)

> **@architect (Aria)** — quando Epic 5 estiver próximo do fim, detalhar decisões técnicas do Epic 6 (Segurança em Camadas & Hardening): (a) estratégia de INSERT em `link_clicks` sob RLS (preferência por `security definer` + RPC vs. admin client com SERVICE_ROLE); (b) backing store de rate limiting compatível com free tier (Supabase-native via RPC, Upstash, Vercel KV); (c) CSP formal com allowlist por asset e trade-offs documentados; (d) middleware edge substituindo o layout guard do MVP, com refresh de access token. Output esperado: `docs/architecture/hardening.md` + revisão de `docs/architecture/rate-limiting.md`. A arquitetura base (`docs/architecture.md`) já está promovível para v1.0 após aprovação deste PRD v1.1.

### Scrum Master Prompt (imediato)

> **@sm (River)** — com PRD v1.1 aprovado e arquitetura v0.3 alinhada, iniciar `*draft` da **Story 1.1** (Inicialização do Next.js 16 com TypeScript strict e Tailwind). Esta story é scaffolding puro e não dependia da reconciliação, portanto pode começar imediatamente. Contexto completo em `docs/prd.md` § 6 Epic 1 e `docs/architecture.md` § 2–5.

---

*PRD v1.1 — reconciliação determinística com arquitetura v0.3. Morgan (Product Manager). Princípio aplicado: "simplificar camadas, não paradigmas". Paradigma moderno (App Router, RSC, Server Actions, BaaS) preservado; controles de produção (RLS, rate limiting, middleware edge, CSP) tornaram-se unidades didáticas dedicadas no Epic 6.*
