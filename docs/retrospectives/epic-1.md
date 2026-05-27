# Retrospectiva — Epic 1: Fundação & Canary

**Data:** 2026-05-27
**Agente:** @sm (River)
**Duração do epic:** ~5h (Wave 1–4 em modo YOLO)

---

## O que funcionou bem

- **Wave-based parallel execution** funcionou perfeitamente para stories sem dependências mútuas (1.2+1.3, 1.7+1.8 em paralelo via git worktrees).
- **YOLO mode** reduziu drasticamente a latência entre decisões — sem aprovações manuais bloqueando o fluxo.
- **Supabase CLI** permitiu criar projetos, aplicar migrations e linkear ambientes sem dashboard manual. Único bloqueio foi o limite de 2 projetos gratuitos (resolvido pausando projetos Tutela).
- **GitHub Actions CI** verde desde o primeiro run — configuração de pnpm cache + Next.js build cache está correta.
- **Vercel API** (sem dashboard) funcionou perfeitamente para criar projeto, configurar env vars por escopo e fazer deploy.
- **Gate agents** (@architect) identificaram e registraram corretamente os critérios de cada wave sem overhead de comunicação.

## O que pode melhorar

- **AGENTS.md contaminado** pelo Vercel CLI (injetou seção "Best practices" não solicitada). Workaround: `git checkout -- AGENTS.md` pós-setup. Considerar adicionar AGENTS.md ao `.vercel`-scoped gitignore ou usar flag `--no-agent-inject`.
- **`@supabase/ssr` ausente do package.json inicial** — a Story 1.7 dependia do pacote mas ele não estava listado. O `@dev` precisou instalá-lo durante a implementação. Próximos epics devem adicionar dependências Supabase na Story 1.4 ao invés de na story que as usa.
- **AC 6 da Story 1.8** (validação por pessoa externa) registrado como débito técnico — considerar incluir validação de README em future review sessions com stakeholder externo.
- **Vercel token expiração** forçou re-autenticação manual durante a Story 1.6. O token Vercel tem TTL longo mas não infinito — documentar rotina de renovação em `.env.example`.

## Métricas

| Wave | Stories | Duração estimada | Gate |
|------|---------|-----------------|------|
| 1 — Tooling | 1.2, 1.3 | ~1h | APPROVED |
| 2 — Infraestrutura | 1.4, 1.5 | ~1.5h | APPROVED |
| 3 — Deploy | 1.6 | ~1h | APPROVED |
| 4 — Canary & Docs | 1.7, 1.8 | ~1h | APPROVED |
| **Total** | **7 stories** | **~4.5h** | ✅ |

## Entregáveis do Epic 1

- ✅ Next.js 16 + TypeScript strict + Tailwind 4 (Story 1.1 — pré-existente)
- ✅ ESLint + Prettier + commitlint + husky (Story 1.2)
- ✅ Vitest + Testing Library (Story 1.3)
- ✅ Supabase Cloud (dev + prod) + migration baseline (Story 1.4)
- ✅ GitHub Actions CI com branch protection (Story 1.5)
- ✅ Vercel deploy com preview automático por PR (Story 1.6)
- ✅ Rota canary `/health` — `https://youtube-biolink.vercel.app/health` (Story 1.7)
- ✅ README v2 com badge CI, setup completo + LICENSE (Story 1.8)

## Próximos passos

Epic 2 — Autenticação & Identidade (Stories 2.x):
- Supabase Auth (magic link / OAuth)
- Tabela `profiles` com schema definido em architecture.md § 9
- RLS básico
- Página de dashboard protegida

**@sm** liberado para draftar Stories 2.1+ após sign-off do Epic 1.
