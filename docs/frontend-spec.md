# youtube-biolink — Frontend Specification

> **Status:** v1.0 — 2026-05-09
> **Owner:** Uma (UX/UI Designer & Design System Architect)
> **Aprovação esperada por:** Owner (Alessandro Varela)
> **Origem:** Handoff @pm → @ux-design-expert ([artefato](.aiox/handoffs/handoff-pm-to-ux-design-expert-20260417T032000Z.yaml)), PRD v1.1 aprovado em 2026-04-17.

---

## Como ler este documento

Este spec **não duplica** o design system nem os wireframes — ele é um **índice canônico**. As fontes de verdade são:

| Camada | Localização | Conteúdo |
|---|---|---|
| **Tokens & fundamentos** | [`docs/design/system/`](./design/system/) | Cores, tipografia, spacing, radii, shadows, voz/tom, ícones, voice/tone |
| **Wireframes navegáveis** | [`docs/design/prototypes/`](./design/prototypes/) | Canvas React + Babel com as 9 core screens em todos os temas/estados |
| **Componentes (UI kits)** | [`docs/design/system/project/ui_kits/`](./design/system/project/ui_kits/) | Dashboard kit + Public Profile kit |
| **Preview cards** | [`docs/design/system/project/preview/`](./design/system/project/preview/) | 12 cartões standalone (buttons, inputs, type, spacing, etc.) |
| **Skill Claude Code** | [`.claude/skills/biolink-design/`](../.claude/skills/biolink-design/) | Símbolico para o design system, invocável por agentes |

**Regra de governance:** edições visuais sempre nos bundles em `docs/design/`. Este spec só descreve **o quê está onde**, **deltas de a11y** e **critérios de aceitação**. Se um bundle e este documento divergirem, **o bundle vence**.

---

## 1. Visão geral

Produto biolink didático (Linktree-like) com 6 pilares fullstack como ementa. Detalhe completo de personas, jornadas e UX principles está no PRD § 3 (User Interface Design Goals). Este spec assume aquela base.

**Resumo da identidade visual** (ver [`docs/design/system/README.md`](./design/system/README.md) para detalhes):

- **Tom:** typographic, generous in whitespace, low chroma — o conteúdo do usuário é o herói; o chrome desaparece.
- **Tipografia:** Inter (Google Fonts, OFL), pesos 400/500/600/700, com `font-feature-settings: "ss01"` em headings e `tabular-nums` em analytics.
- **Cores:** 3 temas oficiais — `light`, `dark`, `accent` — todos derivam dos 8 tokens core (`--color-bg`, `--color-fg`, `--color-muted`, `--color-muted-fg`, `--color-border`, `--color-accent`, `--color-accent-fg`, `--color-accent-soft`). Todos passam WCAG AA em body e ações primárias.
- **Sem gradientes no chrome, sem motion gratuita, sem dark patterns, sem gamification.**
- **pt-BR** em toda a UI (NFR13). `lang="pt-BR"` no `<html>`.

---

## 2. Mapa canônico de screens (UX-1..UX-9)

Cada uma das 9 core screens do PRD § 3 está prototipada em `docs/design/prototypes/project/`. A tabela abaixo é a **fonte autoritativa** de mapeamento ID → arquivo → estados/temas.

| ID | Rota | Artboards no canvas | Arquivo | Componentes principais |
|---|---|---|---|---|
| **UX-1** | `/signup` | `signup` | [`screens/auth.jsx` § SignupScreen](./design/prototypes/project/screens/auth.jsx) | E-mail, username (com prefixo `biolink.dev/@`), senha (com toggle visibility), confirmar senha. Hint inline para regras de username. |
| **UX-2** | `/signup/check-email` | `check-email` | [`screens/auth.jsx` § CheckEmailScreen](./design/prototypes/project/screens/auth.jsx) | Ilustração `mail-check`, lede com e-mail destacado, botão "Reenviar e-mail", hint sobre spam. |
| **UX-3** | `/login` | `login` (ok) + `login-error` | [`screens/auth.jsx` § LoginScreen / LoginErrorScreen](./design/prototypes/project/screens/auth.jsx) | Form e-mail/senha + "esqueci senha" + banner de erro genérico ("Não foi possível entrar. Verifique seu e-mail e senha."). **Banner de erro NÃO revela qual campo falhou** (NFR de segurança). |
| **UX-4** | `/reset-password` + `/reset-password/confirm` | `reset-req` + `reset-confirm` + bonus `confirm-failed` | [`screens/auth.jsx` § ResetRequestScreen / ResetConfirmScreen / ConfirmFailedScreen](./design/prototypes/project/screens/auth.jsx) | 2 telas + 1 estado de link expirado. |
| **UX-5** | `/dashboard` (Perfil) | `dash-profile-light`, `dash-profile-dark` | [`screens/dashboard.jsx` § DashProfileScreen](./design/prototypes/project/screens/dashboard.jsx) | TopBar sticky + tabs + cards: Perfil (display_name, bio com contador `0/160`, avatar URL com preview, username `disabled` com hint) e Aparência (3 swatches de tema). |
| **UX-6** | `/dashboard/links` | `dash-links`, `dash-links-drag`, `dash-links-empty`, `dash-links-accent` | [`screens/dashboard.jsx` § DashLinksScreen / DashLinksEmptyScreen](./design/prototypes/project/screens/dashboard.jsx) | Form inline (título + URL + "Adicionar link"), badge `N de 30`, lista com drag-and-drop, toast info durante drag, estado vazio com ilustração `link`. |
| **UX-7** | `/dashboard/analytics` | `dash-analytics-light`, `dash-analytics-dark` | [`screens/dashboard.jsx` § DashAnalyticsScreen](./design/prototypes/project/screens/dashboard.jsx) | Toggle período `7d/30d/Tudo`, 3 stat cards, gráfico SVG com gradient + linha em `--color-accent`, top links com ranking + barras de share. |
| **UX-8** | `/@username` | `pub-light`, `pub-dark`, `pub-accent` | [`screens/public.jsx` § PublicProfileScreen](./design/prototypes/project/screens/public.jsx) | Coluna centrada 480px max, avatar 92px, display_name (h1), handle, bio, lista de links com `<a target="_blank" rel="noopener noreferrer">`, footer "Feito com biolink". |
| **UX-9** | `/@username` 404 | `pub-404` | [`screens/public.jsx` § NotFoundScreen](./design/prototypes/project/screens/public.jsx) | Glyph "404" outlined em `currentColor`, mensagem clara, CTA "Voltar para a home". |

**Observação para @dev:** o protótipo `PublicProfileScreen` tem um `style={{ backgroundColor: "rgb(237, 211, 169)" }}` hardcoded em `public.jsx:18`. **Ignorar** — a cor de fundo deve vir de `--color-bg` (token do tema ativo). É vestígio de iteração no design canvas.

---

## 3. Design tokens & 3 temas

**Fonte de verdade:** [`docs/design/system/project/colors_and_type.css`](./design/system/project/colors_and_type.css).

Token surface (todos os 3 temas derivam destes nomes):

```
--color-bg          --color-fg            --color-muted        --color-muted-fg
--color-border      --color-accent        --color-accent-fg    --color-accent-soft
--color-success     --color-warning       --color-danger       --color-info
--font-sans         --font-mono           (--text-xs..4xl + --leading-*)
--space-1..12 (4px grid)                  --radius-sm/md/lg/pill
--shadow-sm/md      --ease-out            --duration-fast/base/slow
--max-public (480)  --max-dashboard (720) --topbar-h (64)
```

**Paleta dos 3 temas** (validada WCAG AA):

| Tema | bg | fg | accent | accent-soft | Uso |
|---|---|---|---|---|---|
| `light` | `#FFFFFF` | `#0F172A` | `#2563EB` (azul calmo) | `#DBEAFE` | Default. Sombras `--shadow-sm/md`. |
| `dark` | `#0B1220` | `#E5E7EB` | `#60A5FA` | `#1E3A5F` | Sem `box-shadow` (só `1px` de border em `--color-border`). |
| `accent` | `#FAF7F2` (cream) | `#1A1410` | `#D97757` (amber-clay) | `#F4DDD0` | Tema "branded", contraste quente. |

**Aplicação:**
- Tema é persistido em `profile.theme` (DB) e injetado via classe em `<html>`: `theme-light` (default, sem classe), `theme-dark`, `theme-accent`.
- **SSR:** o tema do owner é aplicado tanto no dashboard quanto em `/@username` **sem FOUC**. Implementação: classe é resolvida server-side no layout root (`app/layout.tsx` para dashboard; `app/[username]/page.tsx` para pública).
- **Status colors** (success/warning/danger/info) NÃO mudam entre temas — são fixas.
- Consulte [`preview/color-themes.html`](./design/system/project/preview/color-themes.html) e [`preview/color-neutrals.html`](./design/system/project/preview/color-neutrals.html) para amostras.

**Validação obrigatória de contraste** — todos os pares abaixo precisam atingir AA em cada um dos 3 temas:

- `--color-fg` sobre `--color-bg` ≥ 4.5:1 (corpo)
- `--color-muted-fg` sobre `--color-bg` ≥ 4.5:1 (legendas)
- `--color-accent-fg` sobre `--color-accent` ≥ 4.5:1 (botão primário)
- `--color-fg` sobre `--color-muted` ≥ 4.5:1 (chips, tabs)

---

## 4. Voz, tom e copy

**Fonte de verdade:** [`docs/design/system/README.md` § Content Fundamentals](./design/system/README.md).

Resumo:

- **pt-BR**, **didático-profissional**, **`você`** (segunda pessoa informal). Nunca `tu`, nunca `o(a) senhor(a)`.
- **Sentence case** em botões, headings, labels. Title Case só para nomes próprios.
- **Sem emoji** no chrome. Permitido apenas em conteúdo do usuário (títulos de link).
- **Limites de comprimento** (NFRs):
  - Botões ≤ 24 chars · Labels ≤ 22 chars · Toasts ≤ 80 chars · Bio ≤ 160 chars (constraint do DB).
- **Mensagens de erro:** blameless, sem culpar o usuário, sem vazar qual campo específico falhou em fluxos sensíveis (login, reset).
- **Empty states:** uma frase + um CTA. Sem ilustração de "pessoa solitária".

---

## 5. Iconografia

**Lucide** (https://lucide.dev), outlined, **stroke 1.5px**, herda `currentColor`, nunca filled, nunca tinted. Detalhes em [`docs/design/system/README.md` § Iconography](./design/system/README.md) e [`docs/design/system/project/assets/ICONS.md`](./design/system/project/assets/ICONS.md).

**Em produção:** `pnpm add lucide-react`, importar por nome (tree-shaken).

**Sizing:** 16px com texto · 20px icon-only · 24px standalone.

**Set canônico do MVP** (mapeamento completo no README):
`plus`, `pencil`, `trash-2`, `grip-vertical`, `eye`/`eye-off`, `arrow-up-right`, `bar-chart-3`, `user`, `palette`, `log-out`, `mail-check`, `check-circle-2`, `alert-circle`, `info`, `loader-2`, `search-x`, `link`, `copy`.

---

## 6. Primitivos UI

**Fonte de verdade:** preview cards em [`docs/design/system/project/preview/`](./design/system/project/preview/) e UI kits em [`docs/design/system/project/ui_kits/`](./design/system/project/ui_kits/).

Lista canônica de primitivos para a Story 4.2:

| Primitivo | Preview | Variants / estados |
|---|---|---|
| **Button** | [`buttons.html`](./design/system/project/preview/buttons.html) | `primary` (default) · `secondary` · `ghost` · `danger`. Sizes: `sm` · `md` (default). Estados: hover (-6% accent), pressed (-12% + scale .98), focus-visible (2px ring), disabled (50% opacity). Modificador `full`. |
| **Input** | [`inputs.html`](./design/system/project/preview/inputs.html) | Texto, e-mail, senha (+toggle eye), URL. Estados: default, focused (2px accent ring + offset 2px), disabled, error (border `--color-danger`). Variantes: `bl-input-prefix`, `bl-input-suffix`. |
| **Textarea** | [`inputs.html`](./design/system/project/preview/inputs.html) | Mesmas regras do Input. Suporta contador externo (`bl-counter` 0/N). |
| **Card** | [`cards-toasts.html`](./design/system/project/preview/cards-toasts.html) | Padding 24px desktop / 16px mobile. `radius-lg`. Border 1px no `dark`; `--shadow-sm` em `light`/`accent`. |
| **Avatar** | [`avatars.html`](./design/system/project/preview/avatars.html) | Sizes 32/56/88/92. Fallback: iniciais do `display_name` (até 2 chars) sobre `--color-muted`, foreground em `--color-fg`. **Nunca silhueta genérica.** |
| **Label / Field** | [`type-body.html`](./design/system/project/preview/type-body.html) | Label acima do input, hint opcional abaixo, contador opcional à direita do label. |
| **Toast** | [`cards-toasts.html`](./design/system/project/preview/cards-toasts.html) | Variants: `success`, `info`, `warning`, `error`. Container com `backdrop-filter: blur(8px)` + bg 90% opacity. Fade in/out 150ms. Posição: bottom-right desktop, bottom-center mobile. |
| **Switch** | (em uso em `dash-links` row) | `role="switch"` + `aria-checked`. Slot ativo `--color-accent`, inativo `--color-muted`. |
| **Tabs** | (em uso em `DashTabs`) | `role="tablist"` + `aria-selected`. Sublinha do tab ativo em `--color-accent`. |
| **Theme picker** | [`theme-selector.html`](./design/system/project/preview/theme-selector.html) | 3 swatches mostrando preview do tema; `aria-pressed` no selecionado. |
| **Link item (público)** | [`link-item.html`](./design/system/project/preview/link-item.html) | Card 100% width, `radius-md`, hover background `--color-muted`, ícone `arrow-up-right` à direita. |

---

## 7. Drag-and-drop acessível (Story 3.4) — **DELTA**

**Esta seção é onde o spec adiciona conteúdo que NÃO está nos protótipos.** O canvas mostra apenas o estado visual de drag (artboard `dash-links-drag` em [`screens/dashboard.jsx:160-180`](./design/prototypes/project/screens/dashboard.jsx)) — falta a alternativa keyboard-accessible exigida pelo PRD § 6 Epic 3 Story 3.4 AC.

**Comportamento autoritativo:**

### 7.1 Mouse / pointer
- Bibliotec a: **`@dnd-kit/core`** + `@dnd-kit/sortable`. Default transform 200ms, ease.
- Trigger: o `grip-vertical` icon (slot `link-grip` no protótipo) é o único handle. O resto da row não inicia drag (evita conflito com botões edit/delete e toggle).
- Estados visuais (já no protótipo):
  - `.dragging` — opacity reduzida + leve elevação `--shadow-md`.
  - `.link-drop-indicator` — barra de 2px em `--color-accent` mostrando posição de drop.
  - `.ghost` — placeholder visual no slot original (opacity 0.5).
- Ao soltar: toast `info` "Solte para reposicionar — a nova ordem é salva automaticamente." (já presente no canvas em `DashLinksScreen variant="drag"`). Persistência via Server Action (optimistic update).

### 7.2 Touch
- Activation distance: 8px (evita drag acidental durante scroll).
- Long-press fallback: 250ms hold no grip ativa modo drag (recomendação `@dnd-kit/core`).
- O resto idêntico a pointer.

### 7.3 Keyboard (alternativa OBRIGATÓRIA — não está no protótipo)
**Adicionar ao componente `LinkRow`:**

```
[focus order]
  grip → titulo → switch → editar → excluir
```

- O **grip-vertical** vira `<button type="button" aria-label="Reordenar 'Curso de Next.js + Supabase'. Use as setas para cima e para baixo para mover.">`. Roving tabindex no grupo de grips (mesmo padrão do `@dnd-kit/sortable`'s `KeyboardSensor`).
- Quando focado:
  - **`Space`** ou **`Enter`** — entra em modo "selecionado para reordenar". Anuncia via `aria-live="polite"`: "Item selecionado. Use setas para mover, Espaço para soltar.".
  - **`ArrowUp` / `ArrowDown`** — move 1 posição. Anuncia: "Movido para posição 3 de 5.".
  - **`Space` / `Enter` novamente** — solta. Anuncia: "Item solto na posição 3. Ordem salva.".
  - **`Esc`** — cancela e restaura posição original. Anuncia: "Reordenação cancelada.".
- Implementação técnica: `@dnd-kit/core` exporta `KeyboardSensor` + `sortableKeyboardCoordinates` que cobrem este fluxo nativamente. Configurar `accessibility.announcements` do `DndContext` com strings em pt-BR.

### 7.4 Screen reader
- Wrapper `<ul role="list" aria-label="Seus links — reordenáveis">`.
- Cada `LinkRow` é `<li>` com `aria-roledescription="link reordenável"`.
- Anúncios via `aria-live="polite"` numa div oculta — gerenciada pelo `DndContext.accessibility.announcements`.

### 7.5 Botões alternativos ↑/↓ (fallback adicional)
Para usuários com deficiências motoras que não conseguem operar drag mas querem feedback visual diferente do keyboard sensor: **adicionar dois icon-buttons ↑/↓** no slot `link-icons` da `LinkRow`, **escondidos por default e revelados via toggle "Modo reordenar"** no header da seção:

- Toggle: `<button aria-pressed="false">Modo reordenar</button>`. Quando `true`, swaps para `aria-pressed="true"` e a lista revela ↑/↓ em cada row (substituindo edit/delete temporariamente).
- ↑ button: `aria-label="Mover 'Curso de Next.js + Supabase' para cima"`. Disabled na primeira posição.
- ↓ button: análogo. Disabled na última.
- Click move 1 posição e persiste via Server Action (mesma rota da reorder por drag).

> **Justificativa:** `@dnd-kit/core` keyboard sensor cobre o requisito WCAG 2.1.1 (Keyboard) e 2.5.7 (Dragging Movements). Os botões ↑/↓ são reforço para usuários que preferem ações discretas e cumprem 2.5.5 (Target Size) com 44×44px mínimo.

### 7.6 `prefers-reduced-motion`
- Quando `(prefers-reduced-motion: reduce)`, **desabilitar transitions de drag** (`@dnd-kit/core` aceita `dropAnimation: null`). Reorder ainda funciona, só sem animação.

---

## 8. Estados por tela (vazio, loading, erro, sucesso)

| Tela | Vazio | Loading | Erro | Sucesso |
|---|---|---|---|---|
| UX-1 `/signup` | n/a | Botão entra em estado `loading` (spinner `loader-2`); inputs ficam `disabled`. | Banner inline `error` acima do form. Validação por campo via hint vermelho (sem revelar qual campo falhou em login). | Redirect para UX-2. |
| UX-2 `/signup/check-email` | n/a | Reenvio: botão entra em `loading`. | Toast `error` se reenvio falhar. | Toast `success` "E-mail reenviado." |
| UX-3 `/login` | n/a | Botão `loading`. | **Já prototipado** em artboard `login-error`. | Redirect para `/dashboard`. |
| UX-4 reset | n/a | Botão `loading`. | Banner inline. Confirmação separada por link expirado em artboard `confirm-failed`. | Toast `success` + redirect para login. |
| UX-5 dashboard/perfil | n/a (sempre tem profile) | Skeleton estático nos campos. | Toast `error` "Não foi possível atualizar o perfil." | Toast `success` "Perfil atualizado." |
| UX-6 dashboard/links | **Já prototipado** (`dash-links-empty`). | Skeleton de 3 rows em `--color-muted`. | Toast `error` por ação (criar/editar/deletar/reordenar). | Toast `success` (uma frase, ≤80 chars). Optimistic updates onde seguro. |
| UX-6 ao tentar 31º link | n/a | n/a | Toast `error` "Máximo 30 links por perfil." Botão "Adicionar" fica disabled visualmente quando `count === 30`. | n/a |
| UX-7 dashboard/analytics | "Sem cliques ainda. Compartilhe sua página para começar a medir." (texto + ícone `bar-chart-3`). | Skeleton dos 3 stats e do gráfico. | Toast `error`. | n/a (somente leitura). |
| UX-8 `/@username` | Layout vazio sem links: avatar + nome + bio, sem `public-link-list`. | SSR — sem loading state visível. | Boundary error → mensagem genérica. | n/a (somente leitura). |
| UX-9 `/@username` 404 | n/a (é o estado em si). | n/a | n/a | n/a |

---

## 9. Layout & responsividade

**Fonte de verdade:** [`styles.css`](./design/prototypes/project/styles.css) e [`docs/design/system/README.md` § Layout rules](./design/system/README.md).

- **Public profile** (`/@username`): coluna única centrada, `max-width: var(--max-public)` = 480px. Mobile-first. Gutter 24px.
- **Dashboard** (`/dashboard*`): top bar 64px sticky + content em coluna única `max-width: var(--max-dashboard)` = 720px. **Sem sidebar no MVP.**
- **Auth** (`/signup`, `/login`, `/reset-password`): coluna centrada 520px max em desktop, full-width em mobile.
- **Forms:** labels acima dos inputs, single column, gap 12px, submit em row separada full-width em mobile.
- **Cards:** padding 24px desktop / 16px mobile, gap 16px entre cards empilhados.
- **Breakpoints:** mobile-first puro. Os artboards do canvas usam 390×760 (mobile), 520×720 (auth), 1180×760 (desktop). Suporte declarado: 360px ↔ 1440px+ (NFR de viewport).

---

## 10. Interaction patterns

- **Optimistic updates** em ações seguras: toggle ativo, criar link, editar título/URL inline, reordenar. Rollback + toast `error` em falha.
- **Confirmações destrutivas:** delete link usa modal `Confirmar exclusão` (não toast desfazer — é definitivo neste MVP).
- **Toast positioning:** bottom-right desktop, bottom-center mobile. Stack vertical, máx 3 visíveis simultaneamente. Auto-dismiss 4s para success/info, 6s para warning/error. Dismissable manualmente.
- **Cliques em links públicos:** Server Action fire-and-forget para tracking; o `<a href>` permanece válido (Ctrl/middle-click abre em nova aba normalmente sem quebrar). `target="_blank" rel="noopener noreferrer"`.
- **Hover** (apontador): botões darken accent por ~6% via `color-mix(in oklab, var(--color-accent), black 6%)`. Ghost buttons preenchem com `--color-muted`. Links sublinham.
- **Press** (active): -12% accent + `transform: scale(0.98)` por 80ms.
- **Focus-visible:** ring 2px `--color-accent` com `outline-offset: 2px`. Sempre visível — `outline: none` é proibido.
- **Disabled:** `opacity: 0.5` + `cursor: not-allowed`. Sem grayscale.
- **Animação:** fades de 150ms com `cubic-bezier(0.16, 1, 0.3, 1)`. **Sem bounce, parallax, scroll-linked motion, marquee ou skeleton shimmer.**
- **`prefers-reduced-motion: reduce`:** zera todas as transitions globalmente.

---

## 11. Acessibilidade — checklist por tela

Aplicar [`docs/design/system/README.md` § Visual Foundations](./design/system/README.md) +:

| Tela | Verificações WCAG AA específicas |
|---|---|
| **UX-1 signup** | Labels associadas via `for/id` · `aria-describedby` em hints · `aria-invalid` ao erro · botão "Mostrar senha" com `aria-pressed` · `autocomplete="new-password"` |
| **UX-2 check-email** | Botão reenviar com `aria-live="polite"` para anunciar status · `aria-busy` durante request |
| **UX-3 login** | Banner de erro com `role="alert"` · `autocomplete="current-password"` · link "esqueci senha" sem `tabindex` custom |
| **UX-4 reset** | Igual UX-3 · senha nova com `autocomplete="new-password"` |
| **UX-5 dashboard/perfil** | Bio com `aria-describedby` apontando ao contador · campo username com `aria-disabled="true"` + hint ("não pode ser alterado") · theme picker com `role="radiogroup"` e `role="radio"`+`aria-checked` |
| **UX-6 dashboard/links** | Lista `<ul role="list">` · drag handle com `aria-label` descritivo (ver § 7) · switch com `role="switch"` (já no protótipo) · botões edit/delete com `aria-label` (já no protótipo) · ao deletar, foco volta para o item anterior · contador `N de 30` com `aria-live="polite"` |
| **UX-7 dashboard/analytics** | Gráfico SVG com `<title>` + `<desc>` · alternativa textual via `<figcaption>` resumindo total e tendência · toggle período `role="tablist"`+`aria-selected` |
| **UX-8 /@username** | `<h1>` único = display_name · `<main>` único · alt em avatar = display_name (não `alt=""`) · links com `rel="noopener noreferrer"` · footer com `<footer role="contentinfo">` |
| **UX-9 404** | Status code 404 + `<h1>Página não encontrada</h1>` · CTA com text claro · sem `aria-hidden` ocultando conteúdo |

**Checagens globais (todas as telas):**
- `lang="pt-BR"` no `<html>`.
- Skip link "Pular para o conteúdo" (apenas no dashboard, opcional na pública por ser coluna única).
- Foco gerenciado em transições (auth → dashboard, modal open/close).
- Sem `outline: none` sem substituto.
- Contraste validado nos 3 temas (ferramenta: WebAIM Contrast Checker ou DevTools).
- Teste com **NVDA** (Windows) e **VoiceOver** (macOS).
- Teste com `prefers-reduced-motion` ativo.
- Teste navegação 100% por teclado (sem mouse) cobrindo: signup → login → dashboard → criar link → reordenar 1 link → analytics → ver pública → 404.

---

## 12. Critérios de aceitação (do handoff @pm)

- [x] Cada uma das 9 core screens tem wireframe mobile e/ou desktop + estados (vazio, loading, erro, sucesso quando aplicável). **Coberto em § 2 + § 8.**
- [x] 3 temas documentados com tokens CSS variables. **Coberto em § 3 + `colors_and_type.css`.**
- [ ] Contraste WCAG AA validado em cada tema. **Validação manual pendente (§ 11). Owner: @ux-design-expert antes de PR fechar.**
- [x] Drag-and-drop spec cobre mouse, toque, keyboard, screen-reader. **Coberto em § 7.**
- [x] ≥7 primitivos UI documentados com variants e estados. **11 primitivos em § 6.**
- [x] Spec pronto para @sm draftar Stories 4.1 (tokens), 4.2 (primitivos), 4.3 (seletor de tema), 4.4 (aplicação consistente) sem ambiguidade. **Mapa em § 13.**

---

## 13. Mapa para stories (entrada para @sm)

| Epic | Story | Fonte do spec | Artefatos a referenciar |
|---|---|---|---|
| 1.1 | Scaffolding Next.js | n/a (independente) | n/a |
| 2.* | Auth flows | § 2 (UX-1..UX-4) + § 8 + § 11 | `auth.jsx`, `cards-toasts.html` |
| 3.1 | CRUD links | § 2 (UX-6) + § 8 + § 10 | `dashboard.jsx`, `link-item.html` |
| 3.2 | Toggle ativo | § 6 (Switch) + § 11 | `dashboard.jsx` |
| 3.3 | Limite 30 links | § 8 (UX-6 ao tentar 31º) | n/a |
| **3.4** | **Drag-and-drop acessível** | **§ 7 (DELTA crítico)** | `dashboard.jsx` (variant=drag), `@dnd-kit/core` docs |
| 3.5 | Public profile render | § 2 (UX-8) | `public.jsx`, `ui_kits/public-profile/` |
| 4.1 | Design tokens | § 3 | `colors_and_type.css` |
| 4.2 | Primitivos UI | § 6 | `preview/*.html`, `ui_kits/dashboard/` |
| 4.3 | Seletor de tema | § 6 (Theme picker) + § 3 (SSR sem FOUC) | `theme-selector.html`, `dashboard.jsx` (ThemeSwatches) |
| 4.4 | Aplicação consistente do tema | § 3 (regra de SSR + `<html class>`) | `colors_and_type.css` |
| 5.5 | Analytics dashboard | § 2 (UX-7) + § 11 (gráfico SVG a11y) | `dashboard.jsx` (DashAnalyticsScreen) |
| 6.* | Hardening (RLS, rate limit, middleware) | n/a (sem telas novas) | n/a |

---

## 14. Out of scope (lembretes)

- Custom themes / color picker / fontes customizadas → Phase 2.
- OAuth, upload direto de avatar, domínios customizados, billing, PWA offline, apps nativos → fora do MVP.
- i18n → Phase 2; toda copy em pt-BR.
- Observabilidade (Sentry/Axiom) → Phase 2.
- Epic 6 não tem telas novas — tudo invisível ao usuário (RLS, rate limit, middleware, CSP).

---

## Revisões

| Data | Autor | Mudança |
|---|---|---|
| 2026-05-09 | Uma (@ux-design-expert) | v1.0 — spec inicial após oficialização dos bundles `docs/design/system/` e `docs/design/prototypes/`. |
