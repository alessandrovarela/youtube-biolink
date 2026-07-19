# Roteamento da Página Pública — Decisão Canônica

> **Status:** Aprovada (Arquitetura v0.3, decisão H1). Formalizada pela Story 3.6.
> **Autoridade:** `@architect` (Aria) — Design Authority para roteamento.
> [Source: architecture.md § 2.5 — Reserved-list Routing]

---

## 1. Decisão

A página pública de cada usuário é servida pela **rota dinâmica** `app/[username]/page.tsx`.
Não há `middleware.ts` na raiz no MVP: o **App Router** resolve a colisão entre a rota
dinâmica e as rotas estáticas internas por **precedência de segmento**, e a
**reserved-list** (Story 2.3) impede que qualquer segmento interno seja registrado
como username.

```
app/
├── page.tsx            → /                (landing)
├── [username]/page.tsx → /:username       (página pública — RSC)
├── login/page.tsx      → /login           (rota estática interna)
├── signup/…            → /signup
├── dashboard/…         → /dashboard
├── auth/…              → /auth/callback, /auth/confirm-failed
├── reset-password/…    → /reset-password, /reset-password/confirm
└── health/route.ts     → /health
```

**Sem middleware rewrite.** [Source: architecture.md § 2.5, § 10.3]

> **Atualizado pela Story 6.5 (Epic 6):** passou a existir um `middleware.ts` na raiz,
> mas ele **não faz rewrite nem participa da resolução de rotas** — só auth guard e
> refresh de sessão em `/dashboard/*`. A resolução continua 100% por precedência do
> App Router + reserved-list. Ver § 6.

---

## 2. Precedência do App Router (estáticas > dinâmica)

O Next.js App Router resolve rotas do segmento **mais específico para o menos
específico**. Segmentos estáticos (`/login`, `/dashboard`, `/signup`, `/auth`,
`/reset-password`, `/health`) **sempre vencem** a rota dinâmica `[username]` quando
o path bate exatamente. Ou seja:

| Request        | Resolve para                | Motivo                                  |
|----------------|-----------------------------|-----------------------------------------|
| `/login`       | `app/login/page.tsx`        | segmento estático vence o dinâmico      |
| `/dashboard`   | `app/dashboard/page.tsx`    | segmento estático vence o dinâmico      |
| `/health`      | `app/health/route.ts`       | segmento estático vence o dinâmico      |
| `/alessandro`  | `app/[username]/page.tsx`   | nenhum estático bate → cai no dinâmico  |

Essa precedência é uma **garantia do framework** (não configurável e não
dependente de código nosso). Por isso ela é **documentada aqui** em vez de
testada via servidor: um teste de servidor apenas reconfirmaria comportamento
interno do Next.js, sem cobrir código do projeto. O que **precisa** de teste é a
outra metade da garantia — a reserved-list (ver § 4). [Source: architecture.md § 2.5, § 10.3]

---

## 3. O `@` é display-only

O PRD usa `/@username` como **rótulo de marca** (branding), mas o **path real** no
App Router é `/username` — **sem `@` na URL**. O `@` nunca chega ao roteador.

O rewrite `/@username → /[username]` (para tornar o `@` parte da URL) era um
**stretch opcional da Story 6.5**, explicitamente **fora do DoD** (decisão #3 do
Epic 6). A Story 6.5 foi entregue **sem** o rewrite — ele permanece não implementado.
Links de marca devem continuar apontando para `/username`.
[Source: architecture.md § 2.5 (tabela de alternativas — "Middleware rewrite `/@username`");
prd.md Story 6.5]

---

## 4. Reserved-list ↔ registro de username

A colisão entre a rota dinâmica e as rotas estáticas só é perigosa se um usuário
puder **registrar** um username igual a um segmento interno (ex.: `dashboard`).
Isso é bloqueado por `RESERVED_USERNAMES` em
[`lib/validation/username.ts`](../../lib/validation/username.ts): `validateUsername`
retorna `{ ok: false, error: 'reserved' }` para qualquer nome na lista.

**Paridade obrigatória:** todo **segmento de rota interno de topo** em `app/` DEVE
estar em `RESERVED_USERNAMES`. Cobertura atual (verificada na Story 3.6):

| Segmento em `app/` | Em `RESERVED_USERNAMES`? |
|--------------------|--------------------------|
| `auth`             | ✅                        |
| `dashboard`        | ✅                        |
| `health`           | ✅                        |
| `login`            | ✅                        |
| `reset-password`   | ✅                        |
| `signup`           | ✅                        |

A lista também inclui, por precaução/futuro, nomes ainda sem rota dedicada
(`admin`, `api`, `help`, `logout`, `settings`) e artefatos servidos pela raiz
(`_next`, `favicon.ico`, `robots.txt`, `sitemap.xml`).

> Segmentos **aninhados** (`dashboard/links`, `signup/check-email`,
> `reset-password/confirm`, `auth/callback`) **não** competem com `/[username]`
> (path de um único segmento), portanto não precisam estar na reserved-list.

### Paridade com a regex de formato

`validateUsername` aplica, em ordem: comprimento (3–30) → formato
(`^[a-z][a-z0-9_]*$`, idêntico ao CHECK `username_format` da migration de
`profiles`, Story 2.1) → reserved-list. Nomes com `-`/`.` (ex.: `reset-password`,
`favicon.ico`) já seriam barrados pelo formato; permanecem na lista como
documentação explícita das rotas protegidas. [Source: architecture.md § 2.5;
docs/stories/2.3.story.md]

---

## 5. Teste de cobertura

`tests/unit/reserved-routes.test.ts` prova a metade que depende de código nosso:
para cada segmento de rota interno (`login`, `signup`, `dashboard`, `auth`,
`reset-password`, `health`, `api`), `validateUsername(segmento)` retorna
`ok: false` — nenhuma rota interna pode ser registrada como username. Os segmentos
válidos no formato são bloqueados especificamente com `error: 'reserved'`.

**Nuance de ordenação:** `validateUsername` checa comprimento → formato →
reserved-list. `reset-password` contém hífen, então é barrado ainda mais cedo,
pela regex de formato (`error: 'invalid_format'`) — um bloqueio **mais forte**,
não mais fraco; permanece impossível registrá-lo. Por isso o teste asserta
`ok: false` para todos os segmentos e `error: 'reserved'` apenas para os
format-válidos. A precedência estática > dinâmica é assegurada pelo App Router
(§ 2), não testada aqui.

---

## 6. Middleware edge e headers de segurança (Story 6.5)

> **Atualiza as seções 1 e 3**, que afirmavam "não há `middleware.ts` na raiz no MVP".
> Desde a Story 6.5 (Epic 6) **existe** `middleware.ts` — mas ele **não** faz rewrite
> e **não** participa da resolução de rotas. A precedência descrita na § 2 e a
> reserved-list da § 4 continuam sendo os únicos mecanismos de roteamento.

### 6.1 O que o middleware faz (e o que não faz)

`middleware.ts` na raiz tem **duas** responsabilidades, ambas restritas a `/dashboard/*`:

1. **Auth guard edge** — sem usuário → `redirect('/login?next={pathname}')`, antes do render.
2. **Refresh proativo de token** — padrão de middleware do `@supabase/ssr` (`getUser()` +
   propagação dos cookies renovados na resposta). Fecha a AC5 deferida da Story 2.9.

**Não** faz rewrite de `/@username` (segue stretch não implementado, § 3) e **não**
aplica headers.

### 6.2 O matcher é positivo e enumerado

```ts
export const config = { matcher: ['/dashboard/:path*'] };
```

**Regra a preservar:** nunca substituir por um matcher catch-all com negative
lookahead (o padrão da doc do Next). A página pública é um **segmento raiz dinâmico**
(`/[username]`) — um matcher permissivo a captura, tornando a resposta dinâmica
(ferindo NFR1) e cobrando invocação edge em toda request pública. `tests/unit/middleware.test.ts`
falha se alguém introduzir `(?!` no matcher.

Verificado em runtime: `/[username]`, `/_next/static/*`, `/login`, `/signup`,
`/auth/callback`, `/health` e `/` **não** passam pelo middleware.

### 6.3 Headers de segurança moram em `next.config.ts`, não no middleware

| Onde | O quê | Por quê |
|------|-------|---------|
| `next.config.ts` (`headers()`) | CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` | Cobre **todas** as rotas (inclusive a pública e os assets) sem custo de invocação edge |
| `middleware.ts` | auth guard + refresh de sessão | Precisa do matcher cirúrgico |

Se a CSP morasse no middleware, ficaria limitada ao matcher — `/`, `/login`, `/signup`
e `/[username]` responderiam **sem** headers de segurança.

**HSTS não é definido no app:** a Vercel já aplica `Strict-Transport-Security` em
produção. Duplicar criaria duas fontes de verdade.

### 6.4 CSP sem nonce — tradeoff assumido

A CSP é **enforce** (não Report-Only) e **não usa nonce**. Motivo: um nonce muda a cada
request, tornando a resposta não-cacheável — incompatível com headers estáticos e com o
`revalidate` da página pública (NFR1). Nonce via middleware cobriria apenas `/dashboard/*`,
criando duas CSPs divergentes para manter.

**Consequência assumida:** `script-src` inclui `'unsafe-inline'`, exigido de qualquer forma
pelo payload RSC inline do App Router (`self.__next_f.push`) e pelo script anti-flash do
`ThemeProvider` (Story 4.3). A defesa contra XSS permanece app-layer (escaping do React +
validação de entrada). A CSP ainda entrega `frame-ancestors`, `object-src`, `base-uri`,
`form-action` e um `connect-src` restrito ao Supabase.

Diretivas cuja remoção quebraria a UI **silenciosamente** (mudar só com verificação de console):

- `style-src 'unsafe-inline'` — Tailwind 4, `next/font` e `style={{...}}` (Avatar, nav,
  theme-selector, dnd-kit) serializado como atributo `style=` no SSR.
- `img-src https:` — `profile.avatar_url` é URL **arbitrária** do usuário em `<img>` puro.
- `connect-src <supabase>` — REST/Auth do Supabase.

`'unsafe-eval'` e `ws:` entram **apenas em dev** (HMR/react-refresh). Verificado: os chunks
de produção não usam `eval`/`new Function`.

---

## 7. Referências

- `docs/architecture.md` § 2.5 (Reserved-list Routing) e § 10.3 (árvore `app/`).
- `docs/prd.md` § 6 — Epic 3, Story 3.6; Story 6.5 (middleware edge + CSP, Epic 6).
- `lib/validation/username.ts` — `RESERVED_USERNAMES`, `validateUsername`.
- `docs/stories/2.3.story.md` — origem da reserved-list.
