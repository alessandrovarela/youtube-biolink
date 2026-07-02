# Retrospectiva — Epic 3: Links & Página Pública

**Data:** 2026-07-01
**Agentes:** @pm (Morgan), @sm (River), @po (Pax), @dev (Dex), @architect (Aria), @qa (Quinn), @devops (Gage)
**Duração do epic:** sessão única, 3 waves em modo YOLO (worktrees paralelos)

Primeiro **vertical slice** do produto: dashboard de links + página pública `/[username]` SSR. Produto publicável ponta a ponta.

---

## O que funcionou bem

- **Waves paralelas via worktrees isolados** — até 3 stories implementadas simultaneamente por subagentes, cada uma na sua branch, sem conflito de git HEAD. Wall-clock muito menor.
- **Reconciliação PRD × Arquitetura antecipada** — o conflito "PRD pede `zod` vs arquitetura decide validação inline" foi pego na fase de story/validação (@po ratificou), não na implementação. Zero retrabalho.
- **QA revisando código real** (não só relatórios de agente) — pegou débitos LOW concretos (`reorderLinks` N-updates, atomicidade de `position`) e confirmou authz app-layer consistente.
- **Teste manual do owner encontrou o que os testes automatizados não pegam** — bug do reset de senha (Story 2.7) e link de navegação faltando. Testes de integração cobrem o nível Supabase, não o clique real no e-mail nem a descoberta de UX.
- **Gate de processo de prod fechado** — a migration de produção deixou de ser passo manual/esquecível e virou CD real no `ci.yml`.

## O que pode melhorar

- **Gotcha de worktree:** worktrees isolados podem ser cortados de um commit desatualizado (origin/main), não do HEAD local. **Mitigação adotada:** criar a branch sempre com `git checkout -b <branch> main` explícito. Custou uma consolidação extra na Wave 1.
- **Migration de prod não estava no fluxo do epic** — foi tratada como pendência pós-merge e quase passou batido (a suposição de "integração automática" era falsa; sempre foi CLI). Agora coberto pelo job `migrate-production`.
- **Bug do Epic 2 só apareceu no teste manual do Epic 3** — o reset de senha nunca tinha sido exercido ponta a ponta (clique no e-mail). Falta um smoke manual/E2E dos fluxos de auth. Débito: validação e2e do reset por e-mail (bloqueada por rate limit do SMTP dev).
- **Descoberta de features (navegação)** — a Story 3.3 criou `/dashboard/links` mas não a tornou acessível pela UI. Navegação/menu formal fica no Epic 4, mas vale checar "a feature é alcançável?" no DoD.

## Métricas

- **Stories:** 6 (3.1–3.6) — todas Ready for Review → QA PASS (2 com CONCERNS LOW)
- **Waves:** 3 (Fundação · CRUD & Pública · Reordenação)
- **Testes:** 92 verdes (14 arquivos) — unit (mock) + integração contra dev real
- **PRs:** #7 (epic + 2 fixes), #8 (CD de migrations)
- **Fixes extras:** reset de senha (2.7), NextLink interno (Wave 2), link de navegação dashboard→links (3.3)
- **Deploy:** migration `links` aplicada em dev + **prod**; CD automatizado

## Entregáveis do Epic 3

- `supabase/migrations/*_links.sql` — schema `links` (app-layer authz, sem RLS)
- `lib/validation/url.ts` — `sanitizeLinkUrl` (allowlist http/https, zero-dep)
- `lib/actions/links.ts` — `createLink`/`updateLink`/`deleteLink`/`toggleLinkActive`/`reorderLinks`
- `app/dashboard/links/` + `components/dashboard/links-manager.tsx` — CRUD + drag-and-drop
- `app/[username]/page.tsx` + `not-found.tsx` + `lib/queries/public-page.ts` — página pública SSR
- `docs/architecture/routing.md`, `docs/architecture/ER.md`
- `docs/qa/gates/epic-3-qa-gate.yml`, `docs/qa/epic-3-manual-test.md`
- CD: job `migrate-production` no `.github/workflows/ci.yml`

## Decisões que valem para os próximos epics

- Validação **inline TS + helpers puros** (sem `zod`) — padrão consolidado.
- Authz **app-layer** (`auth.uid()`); RLS é o Epic 6.
- Routing `app/[username]` + reserved-list; `@` display-only.
- Página pública com `createPublicClient` (anon stateless) para preservar ISR.
- Migrations de prod agora automatizadas pela CI (não aplicar na mão).

## Próximos passos

- **Epic 4 — Design System & Temas:** formalizar tokens, primitivos reutilizáveis (Button, Input, Card, Avatar), 3 temas via CSS variables, navegação/layout consistente (dashboard ↔ links ↔ perfil), acessibilidade WCAG AA.
- Follow-up: validação e2e do reset por e-mail; débitos LOW do QA gate.

**@pm** liberado para orquestrar o Epic 4 após este sign-off.
