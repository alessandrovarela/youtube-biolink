# Design System — youtube-biolink

> Documentação viva do design system construído no **Epic 4**. Consolida o que foi
> efetivamente implementado nas stories 4.1–4.4: **tokens** (CSS variables), a
> biblioteca de **primitivos** em `components/ui/`, os **3 temas** (light/dark/accent)
> e a validação de **acessibilidade** (contraste WCAG AA).
>
> **Fonte de verdade dos tokens:** [`app/globals.css`](../app/globals.css).
> **Primitivos:** [`components/ui/`](../components/ui/).
> **Helpers de tema:** [`lib/theme.ts`](../lib/theme.ts).

---

## Sumário

- [1. Fundamentos](#1-fundamentos)
- [2. Tokens](#2-tokens)
- [3. Primitivos](#3-primitivos)
- [4. Temas](#4-temas)
- [5. Acessibilidade](#5-acessibilidade)
- [6. Decisões](#6-decisões)

---

## 1. Fundamentos

O design system é **CSS-first** e **token-driven**:

- Todos os valores visuais moram como **CSS variables** em `:root` (tema light,
  default) e são sobrescritos por classe em `html.theme-dark` / `html.theme-accent`.
- Os tokens são expostos ao **Tailwind 4** via `@theme inline` — as utilities
  (`bg-bg`, `text-fg`, `border-border`, `rounded-md`, …) emitem `var(--color-*)`
  literalmente, preservando a troca de tema em runtime.
- **Não existe `tailwind.config.ts`** — a configuração vive no próprio CSS.
- Fonte **Inter** self-hosted via `next/font/google` (sem `<link>`/`@import` do
  Google Fonts), exposta em `--font-inter` e referenciada por `--font-sans`.
- Tema é **escolha explícita do usuário** (classe no root), **não** `prefers-color-scheme`.

---

## 2. Tokens

Todos os valores abaixo estão em [`app/globals.css`](../app/globals.css). A coluna
_light_ é o `:root` (default); _dark_ e _accent_ mostram apenas os tokens que cada
tema **sobrescreve** (em branco = herda o valor light).

### 2.1 Cores

| Variável | Light | Dark | Accent | Uso |
|----------|-------|------|--------|-----|
| `--color-bg` | `#ffffff` | `#0b1220` | `#edd3a9` | Fundo do canvas (página/app) |
| `--color-fg` | `#0f172a` | `#e5e7eb` | `#1a1410` | Texto de corpo / conteúdo principal |
| `--color-muted` | `#f1f5f9` | `#1a2233` | `#f0e9dd` | Superfícies secundárias (chips, hover ghost) |
| `--color-muted-fg` | `#475569` | `#94a3b8` | `#5c4f42` | Texto secundário (username, captions, hints) |
| `--color-border` | `#e2e8f0` | `#243046` | `#e5dbc8` | Bordas de cards, inputs, divisores |
| `--color-accent` | `#2563eb` | `#60a5fa` | `#b35536` | Cor da marca / ações primárias, focus ring |
| `--color-accent-fg` | `#ffffff` | `#0b1220` | `#ffffff` | Texto/ícone sobre `--color-accent` |
| `--color-accent-soft` | `#dbeafe` | `#1e3a5f` | `#f4ddd0` | Realce suave de accent (badges, destaques) |
| `--color-surface` | `= --color-bg` | `= --color-bg` | `#ffffff` | Superfície elevada (cards, toasts); difere no accent para contraste |

### 2.2 Status (constantes entre temas)

| Variável | Valor | Uso |
|----------|-------|-----|
| `--color-success` | `#16a34a` | Sucesso (toast, dot) |
| `--color-warning` | `#d97706` | Aviso |
| `--color-danger` | `#dc2626` | Erro / ação destrutiva (Button destructive, erro de input) |
| `--color-info` | `#0284c7` | Informação (toast info) |

### 2.3 Tipografia

Fonte: **Inter** (`--font-sans`), com fallback `ui-sans-serif, system-ui, …`.
Mono: `--font-mono` (stack de sistema). `font-feature-settings: 'ss01'` no `body`.

| Escala | `--text-*` | `--leading-*` | Uso típico |
|--------|-----------|---------------|-----------|
| xs | 12px | 16px | Hints, captions, texto de erro |
| sm | 14px | 20px | Labels, corpo compacto, botões md |
| base | 16px | 24px | Corpo padrão (`html, body`) |
| lg | 18px | 28px | Subtítulos |
| xl | 20px | 28px | Título de seção |
| 2xl | 24px | 32px | Título de página |
| 3xl | 30px | 36px | Display |
| 4xl | 36px | 40px | Display grande |

**Pesos:** `--weight-regular: 400`, `--weight-medium: 500`, `--weight-semibold: 600`, `--weight-bold: 700`.

### 2.4 Spacing (grid de 4px)

| Variável | Valor | | Variável | Valor |
|----------|-------|--|----------|-------|
| `--space-1` | 4px | | `--space-6` | 24px |
| `--space-2` | 8px | | `--space-8` | 32px |
| `--space-3` | 12px | | `--space-10` | 40px |
| `--space-4` | 16px | | `--space-12` | 64px |
| `--space-5` | 20px | | | |

### 2.5 Radii

| Variável | Valor | Uso |
|----------|-------|-----|
| `--radius-sm` | 6px | Focus ring, elementos pequenos |
| `--radius-md` | 10px | Botões, inputs (`rounded-md`) |
| `--radius-lg` | 16px | Cards (`rounded-lg`) |
| `--radius-pill` | 999px | Pills, avatares, dots |

### 2.6 Shadows

| Variável | Light | Dark / Accent* | Uso |
|----------|-------|----------------|-----|
| `--shadow-sm` | `0 1px 2px rgba(15,23,42,.06)` | `0 0 0 1px var(--color-border)` (dark) | Cards |
| `--shadow-md` | `0 6px 16px …, 0 2px 4px …` | `0 0 0 1px var(--color-border)` (dark) | Toasts, elementos elevados |

\* No tema **dark**, sombras viram **borda** (`0 0 0 1px border`) — a elevação é
carregada pela borda, não pela sombra. O tema accent herda as sombras do light.

### 2.7 Motion

| Variável | Valor | Uso |
|----------|-------|-----|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Curva padrão |
| `--duration-fast` | 120ms | Micro-interações (hover de swatch) |
| `--duration-base` | 150ms | Transições de botão |
| `--duration-slow` | 220ms | Transições maiores |

> `@media (prefers-reduced-motion: reduce)` zera todas as durações de transição/animação.

### 2.8 Layout

| Variável | Valor | Uso |
|----------|-------|-----|
| `--max-public` | 480px | Largura máx. da página pública `/[username]` |
| `--max-dashboard` | 720px | Largura máx. do dashboard |
| `--topbar-h` | 64px | Altura da topbar/nav do dashboard |

---

## 3. Primitivos

Biblioteca em [`components/ui/`](../components/ui/). Todos consomem tokens via
utilities do Tailwind 4. Helper de classes: [`lib/cn.ts`](../lib/cn.ts) (`cn`) —
sem `clsx`/`cva`/libs externas. O foco visível é global (`*:focus-visible` no
`globals.css`), então nenhum primitivo redefine focus.

### 3.1 Button

Server component (sem hooks); usável dentro de forms client.

- **Props:** `variant`, `size`, `loading`, + todos os `ButtonHTMLAttributes`.
- **Variants:** `primary` (accent) · `secondary` (muted) · `ghost` (transparente) · `destructive` (danger).
- **Sizes:** `sm` · `md` (default) · `lg`.
- **Estados:** `disabled` e `loading` (spinner + `disabled` + `aria-busy`). `type` default `button` (evita submit acidental).

```tsx
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="md">Salvar</Button>
<Button variant="secondary">Cancelar</Button>
<Button variant="destructive" loading>Excluindo…</Button>
<Button variant="ghost" size="sm" type="submit">Sair</Button>
```

### 3.2 Input

Client (`useId` + `forwardRef`). Renderiza label + input + hint/erro com a11y.

- **Props:** `label`, `error`, `hint`, + `InputHTMLAttributes`.
- **A11y:** `aria-invalid` quando há erro; `aria-describedby` liga ao erro (`role="alert"`) ou hint; borda vira `danger` no erro.

```tsx
import { Input } from '@/components/ui/Input';

<Input
  label="Nome de exibição"
  placeholder="Seu nome"
  hint="Aparece na sua página pública"
/>
<Input label="URL do avatar" error="A URL deve começar com http:// ou https://" />
```

### 3.3 Textarea

Mesmos padrões de a11y do Input (`aria-invalid` / `aria-describedby`), para textos longos.

- **Props:** `label`, `error`, `hint`, + `TextareaHTMLAttributes`.

```tsx
import { Textarea } from '@/components/ui/Textarea';

<Textarea label="Bio" hint="Máximo 160 caracteres" rows={4} />
```

### 3.4 Card

Superfície elevada padrão (`bg-surface`, `border-border`, `shadow-sm`, `rounded-lg`, `p-6`).

- **Props:** `HTMLAttributes<HTMLDivElement>` (aceita `className`, `children`).

```tsx
import { Card } from '@/components/ui/Card';

<Card>
  <h2 className="text-lg font-semibold">Aparência</h2>
  {/* conteúdo */}
</Card>
```

### 3.5 Avatar

Client (reage a falha de carregamento). Mostra imagem ou **fallback de iniciais**.

- **Props:** `src`, `displayName` (deriva as iniciais), `size` (px, default 64), `alt`, `className`.
- **Comportamento:** se `src` ausente ou `onError` (404), cai no fallback de iniciais. Reseta a falha quando `src` muda (ajuste de estado durante o render, sem effect). Exporta também `getInitials(name)`.

```tsx
import { Avatar } from '@/components/ui/Avatar';

<Avatar src={profile.avatar_url} displayName={profile.display_name} size={96} />
<Avatar displayName="Alessandro Varela" /> {/* → "AV" */}
```

### 3.6 Label

Rótulo associável via `htmlFor`. Usado internamente por Input/Textarea, mas exportado para uso avulso.

- **Props:** `LabelHTMLAttributes` (`htmlFor`, `className`, …).

```tsx
import { Label } from '@/components/ui/Label';

<Label htmlFor="email">E-mail</Label>
```

### 3.7 Toast

Client (timer + effect). Top-right, auto-dismiss.

- **Props:** `message`, `variant` (`success` default · `error` · `info`), `duration` (ms, default 5000; `0` desativa), `onDismiss`.
- **A11y:** `role="alert"` + `aria-live="assertive"` para `error`; `role="status"` + `aria-live="polite"` para os demais. Dot colorido por variante.

```tsx
import { Toast } from '@/components/ui/Toast';

{saved && <Toast message="Perfil salvo!" onDismiss={() => setSaved(false)} />}
{error && <Toast message={error} variant="error" onDismiss={clear} />}
```

---

## 4. Temas

São **3 temas**, definidos por classe no root. Helpers puros em
[`lib/theme.ts`](../lib/theme.ts): `THEMES`, `Theme`, `isTheme`, `resolveTheme`
(fallback `light`), `resolveThemeClass`.

| Tema | Classe | Personalidade | Quando usar |
|------|--------|---------------|-------------|
| **light** | `:root` (sem classe) | Claro, neutro, azul (`#2563eb`) | Default; leitura diurna, alto contraste |
| **dark** | `theme-dark` | Escuro, azul suave (`#60a5fa`), sombras como borda | Baixa luz, redução de brilho |
| **accent** | `theme-accent` | Marca quente, fundo areia (`#edd3a9`), terracota (`#b35536`), surface branca | Identidade de marca, visual mais expressivo |

### 4.1 Como o usuário seleciona

Card **"Aparência"** em `/dashboard` ([`components/dashboard/theme-selector.tsx`](../components/dashboard/theme-selector.tsx)):
3 swatches clicáveis (`role="radiogroup"` / `role="radio"`) com preview visual de
cada tema. A seleção é **otimista** — aplica o tema instantaneamente e persiste em
`profiles.theme` via a Server Action [`updateTheme`](../lib/actions/profile.ts)
(validação inline `theme ∈ {light,dark,accent}`, filtro `auth.uid()`). Em falha,
reverte e mostra um Toast de erro.

### 4.2 Como é aplicado

**Dashboard (client):** [`ThemeProvider`](../components/dashboard/theme-provider.tsx)
seta a classe (`theme-dark`/`theme-accent`) no `<html>`. O tema inicial vem do
`profile.theme` lido server-side no `dashboard/layout.tsx`; um `<script>` síncrono
inline aplica a classe antes do paint (**sem flash**). Trocas em runtime usam
`useTheme().setTheme` — sem reload.

**Página pública (SSR):** [`app/[username]/page.tsx`](../app/[username]/page.tsx)
lê `profile.theme` (do dono) e a `PublicProfileView` aplica
`resolveThemeClass(theme)` num **container próprio** (o `<html>` mora no root layout
compartilhado e não conhece o tema do dono). Por isso os seletores em `globals.css`
cobrem **os dois escopos**: `html.theme-*, .theme-*`. Como é RSC, a classe já nasce
no HTML do servidor — **sem FOUC**, sem troca client-side.

> Dashboard e página pública sempre mostram o **mesmo tema do usuário** (o do dono, na pública).

---

## 5. Acessibilidade

- **Focus ring universal:** `*:focus-visible` → `outline: 2px solid var(--color-accent)` com offset.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` zera transições/animações.
- **Formulários:** Input/Textarea ligam erro/hint via `aria-describedby`; erro usa `role="alert"` + `aria-invalid`.
- **Toast:** `role`/`aria-live` conforme a severidade.

### 5.1 Contraste WCAG 2.1 AA (validado nos 3 temas)

Validação automatizada em [`tests/unit/a11y-contrast.test.ts`](../tests/unit/a11y-contrast.test.ts):
o teste faz parse dos hex reais de `globals.css` e calcula a razão pela fórmula
oficial do W3C (luminância relativa sRGB → linear). Limiares: **texto normal 4.5:1**;
**UI / texto grande 3:1**.

| Tema | Par | Uso | Razão | Limiar | Resultado |
|------|-----|-----|-------|--------|-----------|
| light | fg / bg | texto de corpo (normal) | 17.85:1 | 4.5:1 | ✅ PASS |
| light | muted-fg / bg | username/secundário (normal) | 7.58:1 | 4.5:1 | ✅ PASS |
| light | accent-fg / accent | rótulo botão primário (normal) | 5.17:1 | 4.5:1 | ✅ PASS |
| dark | fg / bg | texto de corpo (normal) | 15.12:1 | 4.5:1 | ✅ PASS |
| dark | muted-fg / bg | username/secundário (normal) | 7.30:1 | 4.5:1 | ✅ PASS |
| dark | accent-fg / accent | rótulo botão primário (normal) | 7.36:1 | 4.5:1 | ✅ PASS |
| accent | fg / bg | texto de corpo (normal) | 12.59:1 | 4.5:1 | ✅ PASS |
| accent | muted-fg / bg | username/secundário (normal) | 5.46:1 | 4.5:1 | ✅ PASS |
| accent | accent-fg / accent | rótulo botão primário (normal) | 4.56:1 | 4.5:1 | ✅ PASS |

### 5.2 Débito quitado (Story 6.6)

O débito registrado no Epic 4 — `accent-fg` (`#ffffff`) sobre `accent` (`#d97757`)
rendendo **3.12:1**, abaixo de 4.5:1 para texto normal — foi **corrigido na Story 6.6**.
O par é usado como **rótulo de texto** no `Button variant="primary"` (font-medium,
14–15px), portanto rege-se por WCAG 1.4.3 (texto normal, 4.5:1), não por 1.4.11 (UI, 3:1).

`--color-accent` do tema accent passou de `#d97757` → **`#b35536`**, elevando o par a
**4.92:1**. O método é **redução de L em OKLCH mantendo C e H constantes** (L 67.2 → 56.0,
C 0.1306 vs 0.1308 do original, H 38.7°): o croma perceptual da marca fica praticamente
intacto (desvio 0.2%). Uma primeira iteração usou escala RGB uniforme (k=0.81, 4.56:1),
que preserva o matiz **HSL** mas dessatura por construção — custava 15% do croma sem
necessidade; o gate de design da 6.6 corrigiu o método. O limiar do par em
`tests/unit/a11y-contrast.test.ts` subiu de 3.0 para **4.5** nos 3 temas, de modo que a CI
agora **barra regressão**. Focus ring (`accent` sobre `bg` `#edd3a9`) subiu de 2.15:1 para
**3.39:1**, passando a atender 1.4.11 (≥3:1) — antes não atendia.

---

## 6. Decisões

### 6.1 Tailwind 4 + CSS variables (CSS-first) vs alternativas

O design system usa **Tailwind 4 com tokens em CSS variables**, expostos via
`@theme inline` (sem `tailwind.config.ts`). Trade-offs frente às alternativas:

| Abordagem | Prós | Contras | Veredito |
|-----------|------|---------|----------|
| **Tailwind 4 + CSS variables** (escolhida) | Troca de tema em **runtime** trocando 1 classe no root (as vars cascateiam); zero JS para temizar; utilities rápidas; sem build config; um único arquivo de verdade (`globals.css`) | Tokens em CSS "solto" (não tipados em TS); depende da convenção `@theme inline` | ✅ **Escolhida** |
| **CSS Modules** | Escopo local, sem runtime | Sem sistema de tema nativo (recairia em CSS vars mesmo); muito boilerplate por componente; sem utilities | ❌ |
| **vanilla-extract** | Type-safe, zero-runtime, temas em TS | Build/setup extra; temas por classe gerada; curva de aprendizado; over-engineering para o escopo | ❌ |
| **styled-components** | DX de CSS-in-JS, theming via Provider | **Runtime** (custo de JS/hidratação), atrito com RSC do Next 16; bundle maior; contra a orientação de "sem libs de UI" | ❌ |

**Por que a escolhida vence aqui:** temas por **classe no root** + CSS variables dão
troca instantânea sem JS e funcionam **tanto no client (dashboard) quanto no SSR
(página pública)** com o mesmo mecanismo. O `@theme inline` é o detalhe crítico: sem
`inline`, o Tailwind inlinearia o valor resolvido em build e a troca de tema em
runtime **não** funcionaria.

### 6.2 Outras decisões registradas

- **Tema por classe no root, não `prefers-color-scheme`.** Tema é escolha explícita
  do usuário (persistida em `profiles.theme`), não do sistema operacional. `:root` =
  light default; `.theme-dark`/`.theme-accent` sobrescrevem. Defense-in-depth:
  `resolveTheme`/`resolveThemeClass` fazem fallback para `light` em valores inválidos,
  além do CHECK do banco.
- **Validação inline, sem libs (zod etc.).** `updateTheme` valida `theme ∈ {light,dark,accent}`
  com `isTheme` (type guard puro). Formulários validam inline nas Server Actions.
  Alinhado ao Artigo IV (No Invention) — sem dependências novas.
- **Fonte via `next/font`, não `@import`/`<link>`.** `next/font/google` auto-hospeda
  a Inter (sem render-blocking, sem chamada ao Google Fonts) e injeta `--font-inter`,
  ligada a `--font-sans`.
- **Sem libs de UI / helpers próprios.** `cn` local em vez de `clsx`/`cva`; primitivos
  escritos à mão a partir das specs visuais. Menos dependências, mais didático.
