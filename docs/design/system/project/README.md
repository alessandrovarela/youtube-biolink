# Biolink Design System

> Design system for **youtube-biolink** — an educational, open-source biolink (Linktree-style) app built with Next.js 16 + Supabase as a teaching artifact for modern fullstack development.

---

## Project Context

**youtube-biolink** is a *didactic* product: a real, publishable biolink page generator that doubles as a curriculum for teaching the 6 fullstack pillars (Auth, DB/RLS, SSR/RSC, CI/CD, Analytics, Design System). Users sign up, claim a `@username`, configure links, and share `domain.com/@username`.

The product is propositionally simple — "pretty enough not to look like a study project, simple enough to teach." No motion gratuitous effects, no dark patterns, no gamification. Mobile-first, accessible, fast.

### Surfaces

The system covers two product surfaces:

1. **Public profile page** (`/@username`) — minimalist, fast, mobile-first. Avatar, display name, bio (≤160 chars), and a clickable list of links. SSR-rendered. Carries the chosen theme.
2. **Dashboard** (`/dashboard`) — authenticated workspace where the user edits profile, manages links (CRUD + drag/drop reorder + active toggle), picks a theme, and views click analytics.

Auth surfaces (`/signup`, `/login`, `/reset-password`) round out the picture.

### 3 Themes (selectable per user)

The product ships **exactly 3 user-selectable themes**, persisted on the profile and applied to both the public page and the dashboard:

- **`light`** — clean white background, dark ink, neutral blue accent. Default.
- **`dark`** — dark slate background, soft white ink, same accent family.
- **`accent`** — warm amber background (`#EDD3A9`), dark ink, vibrant accent — meant to read as "branded". Cards/buttons use `--color-surface: #FFFFFF` for contrast against the colored canvas.

All three derive from the same token surface: `--color-bg`, `--color-fg`, `--color-muted`, `--color-accent`, `--color-accent-fg`, `--color-border`, `--color-surface`. In light/dark, `--color-surface` equals `--color-bg`; in themed canvases (accent) it diverges to keep elevated elements (cards, link buttons) readable. Custom themes / color picker / fonts / CSS overrides are explicitly **out of scope** for the MVP (Phase 2 territory).

---

## Sources Consulted

- `docs/brief.md` — Project Brief v1.0 (Atlas, Business Analyst)
- `docs/prd.md` — PRD v1.1 (Morgan, PM) — feature requirements + UI design goals
- `docs/architecture.md` — Architecture v0.3 (Aria, Architect) — stack, routes, components, DDL
- `docs/stories/`, `docs/architecture/`, `docs/guides/` — empty at time of authoring (planned to be populated by stories during build)

The project has **no production codebase yet** — implementation is staged in stories. This design system is therefore a *forward-looking* artifact: it locks in the visual + interaction language so the upcoming epics build against a consistent foundation rather than discovering tokens story by story.

A note on language: the product UI ships in **pt-BR** (NFR13). All copy in this design system follows that.

---

## Index

| File | Purpose |
|---|---|
| `README.md` | This file — context, content/visual fundamentals, iconography |
| `colors_and_type.css` | Design tokens: colors, type, radii, shadows, spacing — drop in any HTML to use |
| `SKILL.md` | Agent skill front-matter — makes this folder importable into Claude Code |
| `fonts/` | Web fonts (Inter — see Substitutions) |
| `assets/` | Logo, brand mark, illustrative imagery, icon notes |
| `preview/` | Per-card design system previews (registered for the Design System tab) |
| `ui_kits/dashboard/` | Dashboard UI kit — auth, profile, links, analytics |
| `ui_kits/public-profile/` | Public profile page UI kit — `/@username` |

---

## Content Fundamentals

### Voice and tone

The product speaks **pt-BR**, **didactic-professional**, **second-person informal** (`você`). Copy is short, direct, and never cute. Microcopy explains *what to do next*, never *what just happened in technical jargon*. Errors are blameless ("Não foi possível atualizar o perfil") and never leak which field failed for security-sensitive surfaces (login).

| Aspect | Rule |
|---|---|
| Pronoun | `você` (second-person informal). Never `tu`, never overly formal `o(a) senhor(a)`. |
| Casing | Sentence case in buttons, headings, and labels. Title Case is reserved for proper nouns. |
| Punctuation | No trailing punctuation in buttons or single-line labels. Full sentences end normally. |
| Emoji | **Never** in product UI. Acceptable only in marketing-style illustrations or explicitly opt-in user content (link titles). |
| Numbers | Cardinal numbers as digits in UI ("30 links", not "trinta links"). |
| Length | Buttons ≤ 24 chars. Field labels ≤ 22 chars. Toast messages ≤ 80 chars. Bio is hard-capped at 160 chars (DB constraint). |
| Empty states | One short sentence + one CTA. No illustrations of "lonely person." |

### Concrete copy examples

**Buttons** (CTAs and actions):
- `Entrar` · `Criar conta` · `Salvar` · `Adicionar link` · `Reordenar` · `Sair` · `Confirmar exclusão`

**Field labels:**
- `E-mail` · `Senha` · `Nome de usuário` · `Nome de exibição` · `Bio` · `URL do avatar` · `Título` · `URL`

**Helper text / hints:**
- `Mínimo 8 caracteres.`
- `Apenas letras minúsculas, números e _ — começa com letra.`
- `Até 160 caracteres.`

**Error messages:**
- `Nome de usuário já em uso.`
- `URL inválida — use http:// ou https://.`
- `Não foi possível entrar. Verifique seu e-mail e senha.` (deliberately vague; security)
- `Máximo 30 links por perfil.`

**Empty states:**
- *No links yet:* `Você ainda não tem links. Adicione o primeiro acima.`
- *No clicks yet:* `Sem cliques ainda. Compartilhe sua página para começar a medir.`

**Success toasts:**
- `Perfil atualizado.` · `Link criado.` · `Tema aplicado.` · `Reordenação salva.`

### Tone rules of thumb

- **No marketing-speak.** Don't say "Crie sua presença online incrível" — say "Crie sua página de links."
- **Don't apologize unprovokedly.** "Não foi possível…" is fine. "Sentimos muito, ocorreu um problema…" is not.
- **Be specific about limits.** "Máximo 30 links" is better than "Limite atingido."
- **Be didactic where the user is learning** (e.g., the README, the analytics empty state can explain *why* clicks matter). Don't be didactic in core flows — that becomes annoying.

---

## Visual Foundations

The system is **typographic, generous in whitespace, low in chroma**. The product reads like a tasteful link-in-bio page should: the user's content is the hero; the chrome disappears.

### Color

A single pair of neutral surfaces (`--color-bg`, `--color-fg`) plus a muted secondary, a borders/dividers token, and an accent. No gradients in the chrome. The accent is used sparingly: primary buttons, focus rings, the active link in nav, and the analytics chart line. Status colors (success / warning / danger) are derived from a fixed palette outside the themed tokens — they don't change between themes.

- **`light`** — `#FFFFFF` bg, `#0F172A` fg, `#2563EB` accent (a calm blue).
- **`dark`** — `#0B1220` bg, `#E5E7EB` fg, `#60A5FA` accent (the same blue, lifted for contrast on dark).
- **`accent`** — `#FAF7F2` warm-cream bg, `#1A1410` fg, `#D97757` accent (warm amber-clay).

All three pass WCAG AA contrast on body and primary actions. Validated via `colors_and_type.css`.

### Typography

**Inter** (variable font, 400/500/600/700) covers everything. One typeface, one family — the system's restraint *is* its identity. Headings use `font-feature-settings: "ss01"` for the sharper alternate `a` and `g`. Numbers in analytics use tabular figures (`font-variant-numeric: tabular-nums`).

Type scale (base 16):
- `--text-xs` 12px / 16px line · `--text-sm` 14/20 · `--text-base` 16/24 · `--text-lg` 18/28 · `--text-xl` 20/28 · `--text-2xl` 24/32 · `--text-3xl` 30/36 · `--text-4xl` 36/40

Weight tokens: 400 body, 500 UI labels, 600 headings, 700 only for `--text-3xl`+ display.

> **Substitution flag:** the architecture documents a "system sans-serif (`ui-sans-serif` / `Inter` optional)" rather than mandating a font. We've committed to **Inter** (Google Fonts, OFL) as the canonical face because it gives the system one consistent specimen across environments. If the team prefers strictly system fonts, swap `--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;` to `--font-sans: ui-sans-serif, system-ui, sans-serif;` in `colors_and_type.css`. **No font files were provided** — we ship Inter via Google Fonts CDN in the preview cards and UI kits. If self-hosting is desired, drop `Inter-*.woff2` files into `fonts/` and switch the preview `@font-face` blocks accordingly.

### Spacing

A 4-px grid: `--space-1` 4px → `--space-12` 64px. Most padding/gap values are 8 / 12 / 16 / 24. Cards use 24px outer padding on desktop, 16px on mobile.

### Radii

- `--radius-sm` 6px (inputs, small chips)
- `--radius-md` 10px (buttons, cards inner)
- `--radius-lg` 16px (cards outer, modals)
- `--radius-pill` 999px (theme swatches, avatar)

Radii are conservative. No "ultra-rounded blob" cards — this isn't that kind of product.

### Shadows / elevation

Two-step ladder:
- `--shadow-sm` for resting cards on `light`/`accent`: `0 1px 2px rgba(15,23,42,.06)`
- `--shadow-md` for hover/active and toasts: `0 6px 16px rgba(15,23,42,.08), 0 2px 4px rgba(15,23,42,.06)`
- `dark` theme uses **no shadow** (relies on a 1px border in `--color-border` instead — shadows look muddy on near-black).

### Borders

1px solid `--color-border` for separators, card outlines on `dark`, and input outlines. Inputs have a 2px focus ring in `--color-accent` with `outline-offset: 2px`. No double borders.

### Backgrounds

- **No full-bleed photography in the chrome.** The user's avatar is the only image asset on the public page.
- **No gradients in app surfaces.** A single background tone per theme.
- **No repeating patterns / textures / hand-drawn illustrations.** This is a clean utility product.
- The 404 page uses an outlined "404" glyph in `--color-muted`. That's the only "decorative" mark in the product.

### Animation

- **Fades only**, 150ms, `cubic-bezier(0.16, 1, 0.3, 1)` (smooth ease-out). Used on toast enter/exit, page transitions, and hover state changes.
- Drag-and-drop uses `@dnd-kit`'s default transform animation (200ms, ease).
- **No bounces, no parallax, no scroll-linked motion, no marquee, no skeleton shimmer.** Loading states are static skeletons.
- `prefers-reduced-motion: reduce` zeros out all transitions.

### Hover and press states

- **Hover** on buttons darkens accent by ~6% (CSS `color-mix(in oklab, var(--color-accent), black 6%)`). Ghost buttons get a `--color-muted` background fill. Links underline.
- **Press** (active) drops to ~12% darker and shrinks via `transform: scale(0.98)` for 80ms.
- **Focus-visible** uses the 2px ring described above. Always visible — never `outline: none`.
- **Disabled** uses 50% opacity and `cursor: not-allowed`. No grayscale.

### Transparency / blur

Used sparingly: the toast container sits on a 90% opacity `--color-bg` with `backdrop-filter: blur(8px)` to read against any content beneath. The dashboard sticky header (when scrolled) uses the same treatment. Nothing else.

### Layout rules

- **Public page**: single centered column, max-width 480px, content gravity-aligned to the top third on desktop, vertically centered on mobile. 24px outer gutter.
- **Dashboard**: two-region layout — top bar (64px, sticky) + content. Content is a single centered column max-width 720px. No sidebar in the MVP.
- **Forms**: labels above inputs, single column, 12px gap between fields. Submit on the right of the row beneath, full-width on mobile.
- **Cards**: 1px border on `dark`; `--shadow-sm` + transparent border on `light`/`accent`. 24px padding desktop, 16px mobile. 16px gap between stacked cards.

### Imagery

- **Avatar fallback:** initials of `display_name` (up to 2 chars), centered on a `--color-muted` circle in `--color-fg`. Never a generic person silhouette.
- **No stock photography.** The product has no place for it.

---

## Iconography

The app uses **[Lucide](https://lucide.dev)** as its icon library — outlined, 1.5px stroke weight, 24px default size. Lucide is the de facto pairing for shadcn/ui (which architecture.md commits to) and matches our typographic, restrained aesthetic.

> **Substitution flag:** no codebase exists yet (greenfield), so no icons were copied from source. Lucide is selected as the canonical icon system for the design system going forward. We use **Lucide via CDN** (`https://unpkg.com/lucide-static@latest/icons/`) in the previews and UI kits. When the codebase materialises, install `lucide-react` from npm and import per-icon (tree-shaken). The visual specification (stroke 1.5, 24px) and the icon list below should be honoured one-to-one.

### Icon list (the ones the product actually uses)

| Use | Lucide icon |
|---|---|
| Add link | `plus` |
| Edit link | `pencil` |
| Delete link | `trash-2` |
| Reorder handle | `grip-vertical` |
| Toggle visibility | `eye` / `eye-off` |
| External link (open in new tab) | `arrow-up-right` |
| Analytics | `bar-chart-3` |
| Profile | `user` |
| Settings / theme | `palette` |
| Sign out | `log-out` |
| Show/hide password | `eye` / `eye-off` |
| Email confirmation | `mail-check` |
| Success | `check-circle-2` |
| Error / warning | `alert-circle` |
| Info | `info` |
| Loading | `loader-2` (with `animate-spin`) |
| 404 / not found | `search-x` |
| Copy public URL | `link` / `copy` |

### Rules

- **Stroke 1.5px**, never filled. Lucide's defaults already match.
- **Sizes**: 16px in inline buttons (paired with text), 20px in icon-only buttons, 24px standalone. Never larger than 32px in chrome.
- **Color**: inherits `currentColor`. Never tinted (no purple icons in a blue product).
- **Pairing with text**: 8px gap between icon and label. Icon on the left of text in LTR.
- **Emoji**: never in chrome. Permitted in user-generated content (link titles) — render as the user typed them.
- **Unicode glyphs**: never as icons. We have a real icon library.
- **Hand-rolled SVGs**: forbidden. If Lucide doesn't have it, we don't need it (or we add the next-best Lucide icon).

The brand mark itself is set in `assets/logo.svg` and is purely typographic — no glyph mark in the MVP.

---

## Caveats

- **Greenfield project**: no production code or screenshots existed at the time of authoring. The design system is forward-looking, derived from PRD + architecture documents (which are themselves fully approved).
- **Inter is a substitution flag** — the docs left fonts open. We committed to Inter via Google Fonts (OFL). Easy to swap.
- **Lucide is a substitution flag** — no codebase to copy from. Lucide is the canonical pairing for shadcn/ui (which the architecture commits to), so this is a strong default rather than a guess.
- **No real users / fixture content yet** — UI kit demos use plausible Brazilian-flavoured placeholder content (`@alessandro`, "Conteúdo de Next.js + Supabase", etc.) consistent with the project's pt-BR + dev-educator audience.
- **No avatar uploads in MVP** — public profile page demos use external image URLs (Unsplash) as the architecture documents the avatar as an external URL.
