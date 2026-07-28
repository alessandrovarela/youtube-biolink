# youtube-biolink

![CI](https://github.com/alessandrovarela/youtube-biolink/actions/workflows/ci.yml/badge.svg)

> **Projeto didático fullstack.** Construa um clone simplificado do Linktree do zero e
> aprenda, na prática, os pilares de uma aplicação web moderna: autenticação, banco de
> dados, renderização no servidor (SSR/RSC), CI/CD, analytics, design system e
> **segurança em camadas**. Stack: Next.js 16 + Supabase + Vercel.

**Produção:** [https://youtube-biolink.vercel.app](https://youtube-biolink.vercel.app) · **Status:** entregue — Epics 1–6, em produção 🚀

## Sobre o projeto

Este repositório é **material de ensino**, não um produto comercial. Ele foi construído de
forma incremental, organizado em **epics** — cada epic é uma unidade didática que entrega um
pilar completo, com suas stories, decisões de arquitetura registradas (ADRs) e testes. O
produto nasceu em duas fases, espelhando como times reais trabalham: primeiro um **MVP
funcional**, depois um **hardening de segurança**.

**Fase 1 — MVP funcional (os 6 pilares):**

| Epic | Pilar | O que ensina |
|------|-------|--------------|
| 1 | Fundação | Bootstrap Next.js + TypeScript, Supabase Cloud (dev/prod), deploy Vercel, CI/CD, rota canary `/health` |
| 2 | Autenticação & Identidade | Signup/login/reset por e-mail (Supabase Auth), perfil, proteção de rotas |
| 3 | Links & Página Pública | CRUD de links com reordenação, página pública `/username` renderizada no servidor (ISR) |
| 4 | Design System & Temas | Tokens CSS-first (Tailwind 4), primitivos de UI, 3 temas, acessibilidade (contraste WCAG) |
| 5 | Analytics de Cliques | Tracking server-side fire-and-forget, agregação eficiente, dashboard com gráfico |

**Fase 2 — Hardening (pós-MVP):**

| Epic | Pilar | O que ensina |
|------|-------|--------------|
| 6 | Segurança em Camadas | RLS (Row Level Security) como defesa em profundidade sobre a authz da aplicação, rate limiting, proxy de borda com auth guard + Content-Security-Policy |

O Epic 6 mostra o padrão real de quem entrega o MVP primeiro e endurece depois: cada
controle (RLS, rate limit, CSP) vira uma unidade didática própria. As decisões estão nos
ADRs em [`docs/architecture/`](docs/architecture/) e cada epic tem retrospectiva em
[`docs/retrospectives/`](docs/retrospectives/).

## Stack

Next.js 16 · TypeScript strict · Tailwind 4 · Supabase Cloud · Vercel · pnpm 9

## Pré-requisitos

- Node.js 20+
- pnpm 9 (`npm install -g pnpm`)
- Conta gratuita no [Supabase](https://supabase.com) (ou solicitar credenciais do projeto `development` ao owner)

> **Nota:** o projeto não requer Supabase local. Use o projeto `development` na nuvem.

## Setup local

```bash
# 1. Clone o repositório
git clone https://github.com/alessandrovarela/youtube-biolink.git
cd youtube-biolink

# 2. Copie o arquivo de variáveis de ambiente
cp .env.example .env.local

# 3. Preencha as credenciais do projeto Supabase development em .env.local
#    Obtenha em: supabase.com → youtube-biolink-dev → Settings → API

# 4. Instale as dependências
pnpm install

# 5. Inicie o servidor de desenvolvimento
pnpm dev

# 6. Acesse http://localhost:3000
```

## Comandos principais

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm lint` | Verificar código |
| `pnpm format` | Formatar código |
| `pnpm typecheck` | Verificar tipos TypeScript |
| `pnpm test` | Executar todos os testes |
| `pnpm test:unit` | Testes unitários |
| `pnpm test:integration` | Testes de integração |

## Deploy

| Ambiente | URL | Banco |
|----------|-----|-------|
| Production | https://youtube-biolink.vercel.app | Supabase `youtube-biolink-prod` |
| Preview (PRs) | Gerado pelo Vercel bot | Supabase `youtube-biolink-dev` |

Deploy automático: todo merge em `main` publica na URL de produção.
Todo PR recebe uma preview URL comentada pelo bot da Vercel.

## O MVP está pronto quando… ✅ (entregue em 2026-07-27)

Checklist de "Definition of Done" do MVP, derivado dos goals do PRD e do NFR17:

- [x] **Todos os FRs do MVP entregues** — os 24 requisitos funcionais (FR1–FR24) dos Epics 1–5 implementados (auth, links, página pública, temas, analytics).
- [x] **Pipeline CI verde na `main`** — `typecheck` + `lint` + `test` + `build` passando em todo PR e merge (NFR6).
- [x] **Story coverage = 100%** — toda feature tem story em `docs/stories/` antes do merge na `main` (NFR17 / FR24).
- [x] **Smoke test manual passando** — roteiro ponta a ponta de [`docs/smoke-test.md`](docs/smoke-test.md) executado com sucesso pelo owner (signup → perfil/tema → links → página pública → clique → analytics → reset de senha).
- [x] **Release `v0.1.0` taggeada na `main`** e Change Log do PRD promovido (Story 5.6 AC5).
- [~] **Reprodutibilidade externa** — validação por 3 devs externos (Story 5.6 AC4) **dispensada por decisão do owner (2026-07-27)**; o setup local segue documentado neste README.

> Além do MVP, o **Epic 6 (Segurança em Camadas)** foi entregue e verificado em produção — RLS, rate limiting e proxy de borda com CSP ativos. Tags: `v0.1.0` (MVP) · `v0.2.0` (Epic 6).

## Estrutura do projeto

```
youtube-biolink/
├── app/                    # Next.js App Router
│   └── health/route.ts     # Rota canary (GET /health)
├── docs/
│   ├── stories/            # Material didático por epic/story
│   ├── architecture.md     # Arquitetura do sistema
│   ├── prd.md              # Product Requirements Document
│   └── brief.md            # Project Brief
├── supabase/
│   ├── config.toml
│   └── migrations/         # Migration baseline
├── tests/
│   ├── unit/               # Testes unitários (Vitest)
│   └── integration/        # Testes de integração
└── .github/workflows/      # GitHub Actions CI
```

## Documentação

- [Project Brief](docs/brief.md) — visão de produto e proposta de valor
- [PRD](docs/prd.md) — requisitos, epics e stories
- [Arquitetura](docs/architecture.md) — stack, rotas, schema, decisões técnicas
- [Frontend Spec](docs/frontend-spec.md) — mapa UX, tokens de design, a11y
- [Design System](docs/design-system.md) — tokens, primitivos UI, 3 temas, a11y e decisões (Epic 4)
- [ADRs de Arquitetura](docs/architecture/) — decisões registradas, incl. [segurança do Epic 6](docs/architecture/security-epic-6.md) e [dívida técnica](docs/architecture/technical-debt.md)
- [Retrospectivas](docs/retrospectives/) — lições de cada epic
- [Smoke Test Manual](docs/smoke-test.md) — roteiro de validação ponta a ponta (MVP + Epic 6)
- [Stories](docs/stories/) — material didático organizado por epic

---
*Orquestrado com Synkra AIOX*
