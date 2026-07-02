# Retrospectiva — Epic 4: Design System & Temas

**Data:** 2026-07-01
**Agentes:** @pm (Morgan), @dev (Dex), @qa (Quinn), @ux-design-expert (Uma)
**Duração do epic:** sessão única, 4 waves em modo YOLO (subagentes sequenciais no mesmo working tree)

Formalização do design system que nos Epics 2-3 foi tático: tokens, 7 primitivos, 3 temas selecionáveis, navegação coesa, a11y WCAG AA e documentação viva. **Validado pelo owner** em dev local e aprovado.

---

## O que funcionou bem

- **Design system de referência como fonte de verdade** — `docs/design/system/project/` (tokens em `colors_and_type.css`, previews, ui_kits) + skill `biolink-design` eliminaram invenção (Artigo IV): @dev portou valores em vez de criar paleta/escala. Consistência alta com zero retrabalho de design.
- **Stories-solo nas waves críticas** — a 4.2 (toca todas as páginas) rodou sozinha; nenhum conflito de worktree como no Epic 3. Subagentes sequenciais no mesmo tree (sem worktrees) simplificaram o merge — não houve consolidação manual.
- **QA independente e adversarial pegou o que os relatórios dos implementadores não contaram** — revisão do diff real (não dos resumos) achou uma regressão concreta (contador de bio perdeu o feedback vermelho >160) e o débito de contraste do tema accent. Corrigidos na hora (contador) ou documentados (contraste).
- **Zero dependências novas** — helper `cn` local em vez de clsx/cva, nenhuma lib de UI. `package.json` intacto, coerente com o padrão do projeto (sem zod desde o Epic 3).
- **Reconciliação PRD × código antecipada** — o PRD citava `tailwind.config.ts` (Tailwind 3); o projeto é Tailwind 4 CSS-first. Pego no plano, não na implementação.

## O que pode melhorar

- **`build` + lint + 153 testes verdes NÃO garantiram que a app sobe.** No "coloca no ar", o `pnpm dev` (Turbopack/Lightning CSS, parser mais estrito) derrubou TODAS as páginas com 500. Causa: **o Tailwind 4 escaneia arquivos `.md`** e um literal `shadow-[var(--shadow-sm/md)]` (abreviação em prosa numa doc de story) virou classe candidata → gerou `var(--shadow-sm/md)`, CSS inválido. O `next build` (pipeline mais tolerante) não pegou; o dev sim. **Mitigação adotada:** corrigir a doc + adicionar **"`pnpm dev` sobe sem erro de compilação"** ao DoD dos próximos epics. Cuidado com snippets de classe Tailwind em `.md`.
- **Débito de contraste vindo da própria referência** — `accent-fg/accent` no tema accent = 3.12:1 (< 4.5:1 texto normal). Como o valor vem do design de referência, não foi alterado (Artigo IV) — vira follow-up de token no Epic 6. O teste de contraste afere esse par com limiar 3.0 (UI), então a CI não barra o débito.
- **Divergência de preview** — o swatch do tema accent no seletor (creme) não representa o canvas real (dourado); fiel ao `theme-selector.html`. Reportar ao design.

## Métricas

- **Stories:** 5 (4.1–4.5) — todas Ready for Review → **QA gate PASS_WITH_CONCERNS**
- **Waves:** 4 (Tokens · Primitivos & Nav · Temas Aplicados · Docs)
- **Testes:** 153 verdes (27 arquivos) — era 92 no baseline (+61)
- **Commits:** 9 no branch `feature/epic-4-design-system` (inclui 2 fixes pós-QA + 1 fix do dev server)
- **Diff:** 52 arquivos, +3373 / −435
- **Migrations:** nenhuma (`profiles.theme` já existia da Story 2.1)

## Entregáveis do Epic 4

- `app/globals.css` — tokens + 3 temas (`:root` / `html.theme-dark,.theme-dark` / `html.theme-accent,.theme-accent`) via CSS variables + `@theme inline` (Tailwind 4)
- `app/layout.tsx` — fonte Inter via `next/font`; metadata do app
- `components/ui/` — 7 primitivos: Button, Input, Textarea, Card, Avatar, Label, Toast + `lib/cn.ts`
- `components/dashboard/nav.tsx` — navegação Perfil ↔ Links (fecha débito da retro Epic 3)
- `components/dashboard/theme-provider.tsx` + `theme-selector.tsx`, `lib/theme.ts` (`resolveThemeClass`), `updateTheme` em `lib/actions/profile.ts`
- `components/public/PublicProfileView.tsx` — aplicação de tema SSR na página pública
- `docs/design-system.md` — documentação viva; `docs/qa/gates/epic-4-qa-gate.yml`

## Decisões que valem para os próximos epics

- **Tailwind 4 CSS-first** (`@theme inline`, sem `tailwind.config.ts`) — padrão consolidado.
- **Tema por classe no root** (`html.theme-*, .theme-*`): dashboard client (ThemeProvider) + pública SSR (`resolveThemeClass` em container).
- **Design system de referência é autoritativo** — derivar, não inventar.
- **DoD ganha "`pnpm dev` sobe"** — não confiar só em `build`/lint/test; a app tem que efetivamente subir.
- Continua: validação inline (sem libs), authz app-layer (RLS → Epic 6), migrations de prod via CD.

## Próximos passos

- **Push + PR** do Epic 4 → `@devops` (exclusivo).
- **Epic 5 — Analytics de Cliques:** tracking server-side, agregação, dashboard de métricas, smoke test final do MVP. Depende de mergear o Epic 4 (ou ramificar de `feature/epic-4-design-system`).
- Follow-ups: token de contraste do accent (Epic 6), limiar do teste de contraste, swatch de preview do accent (design).
