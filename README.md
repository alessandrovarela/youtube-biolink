# youtube-biolink

![CI](https://github.com/alessandrovarela/youtube-biolink/actions/workflows/ci.yml/badge.svg)

> Projeto didático fullstack: Next.js 16 + Supabase + Vercel.
> Aprenda autenticação, banco de dados, SSR, CI/CD, analytics e design system
> construindo um clone simplificado do Linktree do zero.

**Produção:** [https://youtube-biolink.vercel.app](https://youtube-biolink.vercel.app)

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
- [Stories](docs/stories/) — material didático organizado por epic

---
*Orquestrado com Synkra AIOX*
