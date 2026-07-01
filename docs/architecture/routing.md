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

**Sem middleware rewrite no MVP.** [Source: architecture.md § 2.5, § 10.3]

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

O rewrite `/@username → /[username]` (para tornar o `@` parte da URL) é um
**stretch opcional do Epic 6, Story 6.5** (Middleware + CSP), **fora do escopo do
MVP**. Enquanto isso não existir, links de marca devem apontar para `/username`.
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

## 6. Referências

- `docs/architecture.md` § 2.5 (Reserved-list Routing) e § 10.3 (árvore `app/`).
- `docs/prd.md` § 6 — Epic 3, Story 3.6; Story 6.5 (middleware edge + CSP, Epic 6).
- `lib/validation/username.ts` — `RESERVED_USERNAMES`, `validateUsername`.
- `docs/stories/2.3.story.md` — origem da reserved-list.
