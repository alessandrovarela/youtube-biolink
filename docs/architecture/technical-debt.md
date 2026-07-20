# Débitos Técnicos do Projeto

> **Propósito.** Registro **durável** de defeitos e gaps que foram *identificados com
> evidência* mas cuja correção está **fora do escopo** da story/epic que os encontrou.
> Um débito só entra aqui com **prova reproduzível** e **escopo julgado** — nunca como
> suspeita. Cada item é candidato a virar story própria.
>
> **Autoridade:** `@architect` (Aria) decide roteamento e prioridade.
> **Convenção de id:** `DEBT-NNN`, sequencial, nunca reciclado.

| ID | Título | Severidade | Origem | Status | Dono |
|----|--------|-----------|--------|--------|------|
| [DEBT-001](#debt-001) | `/[username]` declara `revalidate = 60` mas responde `no-store` — o ISR do NFR1 nunca existiu | medium | gate Epic 6 Wave 4, issue #3 | **RESOLVIDO** (pós-Epic 6) | `@dev` |
| [TD-2](#td-2) | CSP com `script-src 'unsafe-inline'` e sem nonce não mitiga XSS | medium | gate final Epic 6 | **Aberto — aceito por impossibilidade estrutural** (reavaliado) | `@architect` |
| [TD-6](#td-6) | Next 16 deprecia `middleware.ts` em favor de `proxy.ts` | low | gate final Epic 6 | **RESOLVIDO** (pós-Epic 6) | `@dev` |
| [TD-7](#td-7) | `?next=` do proxy era parâmetro morto | low | gate final Epic 6 | **RESOLVIDO** (pós-Epic 6) | `@dev` |
| [TD-9](#td-9) | Server Actions do dashboard pagam um `getUser()` extra no proxy | low | gate final Epic 6 | **Medido — nenhuma ação** | `@architect` |

---

<a id="debt-001"></a>

## DEBT-001 — `/[username]` declara `revalidate = 60` mas responde `no-store`

| Campo | Valor |
|-------|-------|
| **Severidade** | medium (performance / custo — **sem** impacto de segurança) |
| **Categoria** | performance |
| **NFR afetado** | **NFR1** (cache agressivo em páginas públicas); pressão indireta sobre **NFR8** (free tier do Supabase) |
| **Origem** | `docs/qa/gates/epic-6-wave-4-gate.yml` — issue #3 |
| **Escopo** | **PRÉ-EXISTENTE.** Anterior a todo o Epic 6. Nenhuma story do Epic 6 causou ou agravou. |
| **Status** | **RESOLVIDO** — causa-raiz identificada e corrigida (ver § Resolução) |
| **Dono** | `@dev` (correção pós-Epic 6) |

### O sintoma

`app/[username]/page.tsx` L12 declara:

```ts
export const revalidate = 60;
```

Mas o comportamento observável é o oposto do declarado:

- O build classifica a rota como **`ƒ` (Dynamic)**, não como `ISR`/`○`.
- A resposta traz `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.

Ou seja: **nenhuma resposta da página pública é cacheada.** O `revalidate = 60` está
**inerte** — presente no código, sem efeito no runtime.

### A evidência

Confirmado **independentemente duas vezes** — pelo `@dev` e depois, do zero, pelo `@qa`
no gate da Wave 4. O @qa fez um **A/B físico**, movendo `middleware.ts` e `next.config.ts`
para fora do projeto (`mv`, não `git stash`) e rebuildando:

| Cenário | Build output | `Cache-Control` |
|---------|--------------|-----------------|
| COM `middleware.ts` + `next.config.ts` (Epic 6) | `ƒ /[username]` | `private, no-cache, no-store, max-age=0, must-revalidate` |
| SEM ambos (baseline pré-Epic 6) | `ƒ /[username]` | idêntico |

**Resultado idêntico nos dois cenários** → a causa não está no Epic 6.

Corroboração adicional:

- `app/[username]/` **não aparece** em `git diff main...HEAD` da branch do Epic 6 — o
  arquivo está intocado.
- `createPublicClient()` **não lê cookies** (`lib/supabase.ts` L49-53).
- **Nenhum** componente da árvore importa `next/headers`.

→ A causa **não** é opt-out dinâmico por cookies/headers, e **não** é o middleware.

### O impacto

Toda visita anônima à página pública paga **render completo + round-trip ao Supabase**.
Custo de compute e de latência em cada request, e pressão desnecessária sobre o free
tier — a mesma preocupação de NFR8 que motivou parte do Epic 6. **Nenhum impacto de
segurança.**

### Por que não foi corrigido aqui

O Epic 6 é de **Segurança & Hardening**. A Story 6.5 apenas **tornou o defeito visível**
ao auditar cache e headers; penalizá-la por ele seria errado — o AC5 pedia que o
comportamento de cache permanecesse **inalterado** pela story, e ele permaneceu
(A/B idêntico). Corrigir exige investigação de causa-raiz em comportamento de
framework, o que é mudança de arquitetura e merece story própria.

### Encaminhamento

**`@architect`** — investigar a causa-raiz e então **decidir**: cumprir a NFR1 ou
**renegociá-la formalmente**. Um `revalidate = 60` inerte no código é pior que nenhum,
porque documenta uma garantia inexistente.

Candidato mais provável levantado pelo gate (**hipótese, não conclusão**): segmento
dinâmico sem `generateStaticParams` combinado ao comportamento de fetch não-cacheado do
`supabase-js` sob Next 16/Turbopack. O gate registrou explicitamente que **não
especulou além disso** e recomenda que quem for corrigir também não o faça — meça antes.

**Consolidar com:** concern #2 do gate da **Wave 1** ("verificação pós-deploy de ISR em
produção"), aberto desde então. Este achado provavelmente **explica** por que aquela
verificação nunca fechou — não havia ISR para verificar.

### Efeito colateral positivo já aproveitado

Como as duas superfícies que um nonce de CSP afetaria (`/[username]` e `/dashboard/*`)
**já são dinâmicas hoje**, o argumento de "nonce quebraria o cache" não se sustenta —
o que foi corrigido em `routing.md` § 6.4 e em `next.config.ts`. Se DEBT-001 for
resolvido, essa decisão de CSP volta à mesa com o tradeoff *de fato* existindo.

### Resolução (pós-Epic 6)

#### Causa-raiz

**No Next 16, uma rota com segmento dinâmico e SEM `generateStaticParams` é
classificada como `ƒ` (Dynamic) e responde `no-store`. O `export const revalidate`
do módulo nunca chega a ser considerado.**

Não é o Supabase, não são os cookies, não é o proxy edge, não é o Turbopack e não é
o comportamento de fetch do `supabase-js`. Todas as hipóteses anteriores — inclusive
a levantada pelo gate — estavam parcial ou totalmente erradas; a do gate ("segmento
dinâmico sem `generateStaticParams` combinado ao fetch não-cacheado do supabase-js")
acertou a primeira metade e errou a segunda, que é irrelevante.

#### A prova

Experimento controlado com 4 rotas-sonda descartáveis, `next build` + `next start`,
medindo classificação de build e `Cache-Control` real por `curl`:

| rota-sonda | `generateStaticParams` | build | `Cache-Control` |
|---|---|---|---|
| `/probe` (segmento **estático**, `revalidate = 60`) | n/a | `○` 1m | `s-maxage=60, SWR` |
| `/probe/[slug]` | **ausente** | `ƒ` | `private, no-cache, no-store` ← o defeito |
| `/probe/[slug]` | `return []` | `●` | `s-maxage=60, SWR` |
| `/probe/[slug]` | `return [{slug:'seed'}]` | `●` 1m | `s-maxage=60, SWR` |

A sonda que **reproduz o defeito não toca em Supabase, cookies nem `fetch`** — só o
segmento dinâmico basta. Isso isola a causa de forma inequívoca e descarta todo o
resto. As sondas foram removidas após a medição.

#### O fix

`app/[username]/page.tsx` ganhou `generateStaticParams()` retornando **lista vazia**.
Vazia de propósito: não queremos prerenderizar username algum no build (a lista muda
a cada cadastro e o build não deve depender do banco). Com `dynamicParams` no default
(`true`), cada username é gerado **sob demanda** na primeira visita e servido do cache
nas seguintes.

Verificado em runtime (`next build && next start`, `curl`):

- Build: `● /[username]` (era `ƒ`).
- 1ª visita: `x-nextjs-cache: MISS`; 2ª: `HIT`.
- `Cache-Control: s-maxage=60, stale-while-revalidate=31535940`.
- Os 4 headers de segurança **continuam presentes** nas respostas cacheadas (vêm de
  `next.config.ts` `headers()`, aplicados no momento da resposta, fora do cache).

#### Consequências verificadas

| Preocupação | Resultado |
|---|---|
| Links recém-editados servem dado velho por 60s? | **Não.** `lib/actions/links.ts` e `lib/actions/profile.ts` já chamavam `revalidatePath('/[username]', 'page')` em toda mutação. Essas chamadas eram **no-ops** enquanto não havia cache; agora fazem o trabalho delas e a invalidação é imediata. Os 60s são o teto para mudanças feitas **fora** do app (ex.: edição direta no banco). |
| Tracking de cliques quebra? | **Não.** `TrackedLink` é client component e chama a Server Action no clique real, fora do render cacheado. Suítes de tracking e rate limiting re-executadas: 126 testes verdes. |
| Um 404 fica congelado? | **Não.** O 404 é cacheado como qualquer resposta e expira em 60s (medido: `MISS` → `HIT` → revalida). Um username recém-criado pode responder 404 por, no máximo, 60s — e só se alguém tiver visitado a URL antes de ele existir. |

> **Nota de honestidade:** não houve validação visual em browser (extensão
> desconectada). Toda a verificação acima é por `curl`, build output e suíte de testes.

**Fecha também** o concern #2 do gate da Wave 1 ("verificação pós-deploy de ISR em
produção"), que nunca fechou porque não havia ISR para verificar. Agora há — e a
verificação em produção passa a fazer sentido (SMOKE: conferir `x-nextjs-cache`).

### Referências

- `docs/qa/gates/epic-6-wave-4-gate.yml` — `isr_debt_independent_verification`, issue #3
- `docs/qa/gates/epic-6-wave-1-gate.yml` — concern #2
- `app/[username]/page.tsx`, `lib/supabase.ts`
- `docs/architecture/routing.md` § 6.4

---

<a id="td-2"></a>

## TD-2 — CSP sem nonce: reavaliado, mantido, e agora por um motivo melhor

| Campo | Valor |
|-------|-------|
| **Severidade** | medium |
| **Status** | **Aberto — aceito.** Reavaliado após a resolução do DEBT-001; a conclusão se manteve, mas a justificativa mudou de "escolha de simplicidade" para **impossibilidade estrutural** na superfície que importa. |
| **Dono** | `@architect` |

O gate registrou que a justificativa original ("nonce quebraria o cache ISR") era
falsa **porque não havia cache**, e recomendou reavaliar quando o DEBT-001 fosse
resolvido. Ele foi. A reavaliação **inverte o argumento**:

1. **Em `/[username]` (agora ISR), nonce e cache são mutuamente exclusivos.** O HTML
   é renderizado uma vez e servido por até 60s, com o nonce **assado** nos
   `<script nonce="…">`. Header CSP gerado por request → nonce novo não casa com o
   assado → **todo script bloqueado**. Header vindo do cache → o nonce vira uma
   **constante pública** compartilhada por todos os visitantes na janela de 60s, o
   que é **pior que não ter nonce**: aparenta mitigação e não mitiga.
2. **Nonce só em `/dashboard/*` foi avaliado e recusado.** Funcionaria (o browser
   intersecta CSPs múltiplas), mas: (a) criaria duas policies divergentes com dois
   ritmos de apodrecimento; (b) o dashboard está atrás de auth e não renderiza HTML
   de terceiros — todo conteúdo de usuário passa por escape do React, e o único
   `dangerouslySetInnerHTML` do projeto (`components/dashboard/theme-provider.tsx`)
   injeta um literal do próprio código com a classe de tema serializada por
   `JSON.stringify`, sem caminho de dado do usuário. Ou seja, protegeria a superfície
   de **menor** exposição e seguiria impossível na de **maior**.

**O preço permanece dito sem eufemismo:** `script-src 'unsafe-inline'` não mitiga XSS.
O ganho da CSP está nos outros diretivos (`object-src`, `base-uri`, `form-action`,
`frame-ancestors`, `connect-src`), que não dependem de nonce.

**O que destravaria:** CSP baseada em **hash** (estável entre requests, convive com
ISR). Hoje inviável porque o payload RSC inline muda por build e por conteúdo. Se o
Next passar a expor os hashes dos seus scripts inline, **reabrir esta decisão**.

Análise completa e permanente no cabeçalho de `next.config.ts`.

---

<a id="td-6"></a>

## TD-6 — `middleware.ts` → `proxy.ts` (RESOLVIDO)

Migração feita: **rename puro**. Mesmo matcher (`/dashboard/:path*`), mesma lógica,
mesmo auth guard, mesmo refresh proativo de token. A única mudança de código é o nome
do export (`middleware` → `proxy`), que o Next exige casar com o nome do arquivo. A
API não divergiu em nada que exigisse mudança de comportamento.

- `middleware.ts` → `proxy.ts`; `tests/unit/middleware.test.ts` → `tests/unit/proxy.test.ts`.
- O aviso de depreciação em todo build/dev **desapareceu** (verificado).
- Comportamento revalidado por `curl` no dev server: `/dashboard` sem sessão → 307
  `/login?next=%2Fdashboard`; `/_next/*` e assets **não** interceptados; `/health`,
  `/login`, `/[username]` e `/auth/callback` intactos.

---

<a id="td-7"></a>

## TD-7 — `?next=` deixou de ser parâmetro morto (RESOLVIDO)

**Decisão: implementar o consumo**, não remover — é melhor UX e a validação já
existia e estava testada.

- `safeNextPath` foi **extraída sem alteração** de `app/auth/callback/route.ts` para
  `lib/validation/next-path.ts`, para servir aos dois consumidores. `route.ts`
  **reexporta** o símbolo, então os testes existentes (`auth-callback-next.test.ts`,
  que travam a classe inteira de truques de open redirect) seguem válidos e o ponto
  de entrada histórico não quebra. **Nenhuma reescrita da função.**
- Fluxo: proxy → `/login?next=<rota>` → a página repassa cru para o form
  (`<input type="hidden">`) → a action `signIn` valida com `safeNextPath` e
  redireciona. Fallback `/dashboard` quando ausente, inválido ou externo.
- A validação acontece **só na borda de saída** (na action, no momento do redirect),
  de propósito: validar em dois lugares cria duas regras que divergem.
- **Teste novo:** `tests/unit/login-next-redirect.test.ts` — 10 casos, incluindo
  `//evil.com`, `/\evil.com`, URL absoluta, `javascript:` e path relativo, mais uma
  asserção de que o símbolo usado é literalmente o mesmo do `/auth/callback`
  (guarda contra divergência futura).

---

<a id="td-9"></a>

## TD-9 — `getUser()` extra nas Server Actions: MEDIDO, nenhuma ação

O gate pediu **medir antes de agir**. Medido.

**Método:** 30 chamadas `supabase.auth.getUser()` com access token **válido** (é só
com token válido que existe round-trip ao Auth server), contra o projeto Supabase de
dev, após warmup.

| min | p50 | média | p95 | max |
|---|---|---|---|---|
| 148 ms | 153 ms | 163 ms | 251 ms | 259 ms |

**Leitura honesta da medição:** ~150 ms é material em termos absolutos, **mas o número
é dominado por latência de rede de uma máquina de dev (macOS, rede residencial) até um
Supabase remoto.** Em produção o proxy roda na edge da Vercel, muito mais perto do
Supabase; este valor é um **teto**, não uma estimativa de produção. Não foi medido em
produção.

**Decisão: NÃO otimizar.** Remover o `getUser()` do proxy para POSTs de Server Action
significa remover o guard justamente do verbo que **muta estado** — abrindo um buraco
na camada que o Epic 6 acabou de construir, para ganhar uma latência que provavelmente
nem existe no ambiente real. O custo medido não justifica desfazer defense-in-depth.

**Revisitar** somente se uma medição **em produção** mostrar o custo material.
