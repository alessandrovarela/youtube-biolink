# youtube-biolink

> Next.js 16 + TypeScript strict + Tailwind 4 — inicializado via Story 1.1 (`create-next-app@latest`).
> Orquestrado com Synkra AIOX.

**Produção:** [https://youtube-biolink.vercel.app](https://youtube-biolink.vercel.app)

## Visão Geral

Biolink didático para criadores de YouTube — página de links centralizada (Linktree-like) construída com Next.js 15 App Router, Supabase (auth + DB), Tailwind CSS e deploy automático na Vercel.

## Deploy

| Ambiente | URL | Banco |
|----------|-----|-------|
| Production | https://youtube-biolink.vercel.app | Supabase `youtube-biolink-prod` |
| Preview (PRs) | Gerado pelo Vercel bot | Supabase `youtube-biolink-dev` |

Deploy automático: todo merge em `main` publica na URL de produção. Todo PR recebe uma preview URL comentada pelo bot da Vercel.

## Getting Started

```bash
# 1. Clone o repositório
git clone https://github.com/alessandrovarela/youtube-biolink.git
cd youtube-biolink

# 2. Instale as dependências
pnpm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do projeto Supabase development

# 4. Inicie o servidor de desenvolvimento
pnpm dev
```

## Documentação

### Artefatos canônicos

- [Project Brief](docs/brief.md) — visão de produto, contexto e proposta de valor (v1.0, @analyst)
- [PRD](docs/prd.md) — requisitos funcionais, NFRs, epics e stories (v1.1, @pm)
- [Arquitetura](docs/architecture.md) — stack, rotas, schema, decisões técnicas (@architect)
- [Frontend Spec](docs/frontend-spec.md) — mapa UX-1..UX-9, tokens, drag-and-drop a11y (v1.0, @ux-design-expert)

### Design system

- [Design System](docs/design/system/) — tokens, voz/tom, ícones, preview cards, ui kits
- [Protótipos](docs/design/prototypes/) — canvas React com as 9 core screens nos 3 temas

O design system também é exposto como Claude Code skill em `.claude/skills/biolink-design` (symlink) — qualquer agente pode invocá-lo durante implementação.

### Trabalho iterativo

- [Stories](docs/stories/) — uma story por unidade de desenvolvimento (a popular pelo @sm)
- [Architecture (sharded)](docs/architecture/) — versão fragmentada para consumo por agentes (gerada sob demanda)
- [Guides](docs/guides/) — guias e tutoriais didáticos (gerados durante o desenvolvimento)

## Workflow AIOX

1. `@analyst *create-doc project-brief` — Project Brief
2. `@pm *create-doc prd` — PRD
3. `@architect` — Arquitetura
4. `@ux-design-expert *create-front-end-spec` — Frontend Spec
5. `@sm *draft` → `@po *validate-story-draft` → `@dev *develop-story` → `@qa *qa-gate` → `@devops *push`

---
*Gerado por AIOX Environment Bootstrap*
