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
| [DEBT-001](#debt-001) | `/[username]` declara `revalidate = 60` mas responde `no-store` — o ISR do NFR1 nunca existiu | medium | gate Epic 6 Wave 4, issue #3 | Aberto | `@architect` |

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
| **Status** | Aberto — **não corrigido de propósito** |
| **Dono** | `@architect` |

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

### Referências

- `docs/qa/gates/epic-6-wave-4-gate.yml` — `isr_debt_independent_verification`, issue #3
- `docs/qa/gates/epic-6-wave-1-gate.yml` — concern #2
- `app/[username]/page.tsx`, `lib/supabase.ts`
- `docs/architecture/routing.md` § 6.4
