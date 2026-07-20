# Roteamento da Página Pública — Decisão Canônica

> **Status:** Aprovada (Arquitetura v0.3, decisão H1). Formalizada pela Story 3.6.
> **Autoridade:** `@architect` (Aria) — Design Authority para roteamento.
> [Source: architecture.md § 2.5 — Reserved-list Routing]

---

## 1. Decisão

A página pública de cada usuário é servida pela **rota dinâmica** `app/[username]/page.tsx`.
Não há arquivo de proxy/middleware na raiz no MVP: o **App Router** resolve a colisão entre a rota
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

> **Atualizado pela Story 6.5 (Epic 6):** passou a existir um `proxy.ts` na raiz
> (criado como `middleware.ts`; renomeado em TD-6 — o Next 16 depreciou o nome antigo),
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

## 6. Proxy edge e headers de segurança (Story 6.5)

> **Atualiza as seções 1 e 3**, que afirmavam "não há arquivo de proxy/middleware na
> raiz no MVP". Desde a Story 6.5 (Epic 6) **existe** `proxy.ts` — mas ele **não** faz
> rewrite e **não** participa da resolução de rotas. A precedência descrita na § 2 e a
> reserved-list da § 4 continuam sendo os únicos mecanismos de roteamento.
>
> **Nome do arquivo (TD-6):** a Story 6.5 criou este arquivo como `middleware.ts`. O
> Next 16.2.6 depreciou essa convenção em favor de `proxy.ts`, e a migração foi feita
> como **rename puro** (mesmo matcher, mesma lógica; só o export mudou de `middleware`
> para `proxy`). O **conceito** continua sendo o de um middleware de edge — inclusive o
> `@supabase/ssr` chama seu padrão de refresh de "middleware pattern".

### 6.1 O que o proxy faz (e o que não faz)

`proxy.ts` na raiz tem **duas** responsabilidades, ambas restritas a `/dashboard/*`:

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
(ferindo NFR1) e cobrando invocação edge em toda request pública. `tests/unit/proxy.test.ts`
falha se alguém introduzir `(?!` no matcher.

Verificado em runtime: `/[username]`, `/_next/static/*`, `/login`, `/signup`,
`/auth/callback`, `/health` e `/` **não** passam pelo proxy.

### 6.3 Headers de segurança moram em `next.config.ts`, não no proxy

| Onde | O quê | Por quê |
|------|-------|---------|
| `next.config.ts` (`headers()`) | CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` | Cobre **todas** as rotas (inclusive a pública e os assets) sem custo de invocação edge |
| `proxy.ts` | auth guard + refresh de sessão | Precisa do matcher cirúrgico |

Se a CSP morasse no proxy, ficaria limitada ao matcher — `/`, `/login`, `/signup`
e `/[username]` responderiam **sem** headers de segurança.

**HSTS não é definido no app:** a Vercel já aplica `Strict-Transport-Security` em
produção. Duplicar criaria duas fontes de verdade.

### 6.4 CSP sem nonce — escolha de simplicidade (não impossibilidade técnica)

A CSP é **enforce** (não Report-Only) e **não usa nonce**.

> **Correção (gate Wave 4, issue #2).** A redação anterior desta seção justificava a
> ausência de nonce com dois argumentos que **não se sustentam**, e ficam registrados
> aqui porque num projeto didático uma justificativa errada ensina a coisa errada:
>
> 1. ❌ *"`'unsafe-inline'` é exigido de qualquer forma pelo App Router."* **Falso.**
>    Nonce via middleware é padrão de **primeira classe** do Next: o framework gera o
>    valor por request e o propaga para os próprios scripts inline do RSC. Os scripts
>    do RSC e o anti-flash do `ThemeProvider` exigem `'unsafe-inline'` **porque não
>    usamos nonce** — não porque o App Router obrigue.
> 2. ❌ *"Um nonce quebraria o cache ISR de `/[username]`."* Era falso **quando escrito**
>    — a rota declarava `revalidate = 60` mas respondia `no-store` (débito DEBT-001).
>
> **Reviravolta (pós-epic, DEBT-001 resolvido).** O item 2 voltou a ser verdadeiro, e
> agora é o argumento decisivo. A causa-raiz do DEBT-001 era outra que ninguém previu
> (segmento dinâmico sem `generateStaticParams` é classificado `ƒ` no Next 16, e o
> `revalidate` nunca chega a ser considerado). Com o fix, `/[username]` **é ISR de
> verdade** — e nonce com cache são **mutuamente exclusivos**: o nonce fica assado no
> HTML cacheado, de modo que ou o header muda por request e não casa (todo script
> bloqueado), ou o header vem do cache e o nonce vira **constante pública compartilhada
> por 60 s** — pior que não ter nonce, porque *aparenta* mitigar.
>
> Ou seja: o trade-off não foi só corrigido, ele **inverteu de lado**. A conclusão
> (manter `'unsafe-inline'`) continua a mesma; o motivo é outro.

**A justificativa verdadeira.** Um nonce muda a cada request, então não cabe em headers
**estáticos** de `next.config.ts`. Implementá-lo exigiria mover a CSP para o proxy, cujo
matcher é cirúrgico (`/dashboard/:path*`) — e aí, uma de três: `/[username]` ficaria sem
CSP; manteríamos **duas policies divergentes**; ou alargaríamos o matcher para toda
request, pagando invocação edge em toda visita anônima (§ 6.2). E, desde que
`/[username]` virou ISR de fato, a rota de maior exposição é justamente a que **não pode**
receber nonce sem perder o cache (ver reviravolta acima).

Nonce apenas em `/dashboard/*` foi avaliado e recusado: funcionaria, mas criaria duas
policies divergentes para proteger a superfície de **menor** exposição — atrás de auth,
com todo conteúdo escapado pelo React e um único `dangerouslySetInnerHTML`, que é literal
do próprio código com `JSON.stringify` —, continuando impossível na de **maior**.

Optamos por **uma única fonte estática de headers**, simples de manter e sem divergência.
É uma escolha de simplicidade proporcional a um MVP didático — legítima, e registrada
como escolha, não como impossibilidade.

**O que destravaria isto no futuro:** CSP por **hash** em vez de nonce (hashes são
estáveis entre requests e portanto compatíveis com cache). Inviável hoje porque o payload
RSC inline muda a cada build e a cada conteúdo.

**O preço, dito sem eufemismo:** `script-src 'unsafe-inline'` **não mitiga XSS** — um
`<script>` injetado executa. O ganho real desta CSP está nos **outros** diretivos:
`object-src 'none'` (plugins legados), `base-uri 'self'` (sequestro de URL relativa),
`form-action 'self'` (exfiltração de credencial por form injetado), `frame-ancestors
'none'` (clickjacking) e um `connect-src` restrito ao Supabase — nenhum deles depende do
nonce. Contra o baseline (**ausência total de CSP**), é ganho líquido e não regressão.
A defesa contra XSS permanece app-layer (escaping do React + validação de entrada).

**Follow-up (reavaliado — a premissa caiu):** este parágrafo antes dizia que adotar
nonce em `/dashboard/*` ficaria "ainda mais natural se/quando DEBT-001 for resolvido".
**DEBT-001 foi resolvido** — e o efeito foi o oposto do previsto. Com `/[username]`
sendo ISR de verdade, a separação "pública estática / dashboard com nonce" não fica
limpa: ela deixa permanentemente sem nonce justamente a rota de **maior** exposição
(anônima, renderizando `avatar_url` arbitrário), para proteger a de **menor** (atrás de
auth, conteúdo escapado pelo React). Ver a "Reviravolta" na abertura desta seção.

O caminho que destravaria de verdade é **CSP por hash**, não por nonce — hashes são
estáveis entre requests e portanto compatíveis com cache. Inviável hoje porque o payload
RSC inline muda a cada build e a cada conteúdo.

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
