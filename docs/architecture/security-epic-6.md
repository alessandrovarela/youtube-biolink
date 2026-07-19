# ADR-001 — Segurança do Epic 6: escrita de tracking sob RLS e rate limiting

> **Status:** Aceita · **Data:** 2026-07-19 · **Autoridade:** `@architect` (Aria) — Design Authority
> **Origem:** `EPIC-6-EXECUTION.yaml` PRE-1 (decisões #1 e #2) · **Bloqueia:** Stories 6.3 e 6.4
> **Contratada pelo PRD:** NFR18 (L90) e Story 5.2 AC3 (L716) delegam ambas as escolhas ao @architect.
> [Source: docs/prd.md — FR21, NFR3, NFR18, NFR19; docs/architecture/ER.md]

Este é o primeiro ADR do projeto e estabelece a numeração `ADR-NNN` para os próximos.
Documentos temáticos já existentes (`ER.md`, `routing.md`) permanecem como estão.

---

## 1. Contexto

O MVP (Epics 1–5) foi entregue com autorização **application-layer**: toda Server Action
filtra por `auth.uid()` / `profile_id = auth.uid()` e nenhuma tabela tem RLS (decisão
consciente, NFR3). O Epic 6 promove o produto a "publicável em produção aberta"
habilitando RLS em `profiles`, `links` e `link_clicks` (Stories 6.1–6.3) e introduzindo
rate limiting (Story 6.4).

Duas consequências dessa mudança exigem decisão arquitetural antes da implementação:

1. **`link_clicks` sob RLS quebra o INSERT de tracking.** `trackLinkClick()`
   (`lib/actions/track-click.ts`) grava o clique com a **anon key** via
   `createPublicClient()`, porque hoje não há RLS. Assim que a Story 6.3 negar INSERT ao
   papel `anon`, esse caminho para de funcionar — e ele **precisa** parar de funcionar
   pela via direta: o concern MEDIUM do QA gate do Epic 5 é exatamente que qualquer um
   pode inserir em `link_clicks` via PostgREST com a anon key pública. Precisamos de uma
   rota de escrita privilegiada, estreita e auditável.

2. **Rate limiting precisa de estado compartilhado entre invocações serverless.** As
   Server Actions rodam em funções efêmeras na Vercel; não há memória compartilhada entre
   instâncias. Contadores exigem um store externo.

**Restrições do projeto que enquadram ambas as decisões:**

- **Zero-dep por princípio** — o projeto recusou `zod` (validação inline), `clsx`
  (`cn` local) e bibliotecas de gráfico (SVG inline). Uma dependência nova precisa se pagar.
- **Didático** — cada controle é uma unidade de ensino; a solução legível vence a esperta.
- **Free tier** (NFR8) — Vercel + Supabase cloud, sem serviço pago adicional.
- **Artigo IV (No Invention)** — nada além do que PRD/Epic contrataram.

---

## 2. Decisão 1 — Escrita de tracking pós-RLS: **RPC `SECURITY DEFINER`** (opção *a*)

**RATIFICADA a recomendação (a).** A opção (b) — `createAdminClient` com
`SUPABASE_SERVICE_ROLE_KEY` no runtime do app — é **refutada** para este caso.

### Justificativa técnica

| Critério | (a) RPC `SECURITY DEFINER` | (b) admin client (service role) |
|---|---|---|
| Superfície de privilégio | **1 operação** (inserir clique em link ativo) | **Banco inteiro**, bypass total de RLS em todas as tabelas |
| Blast radius de um vazamento | Nenhum privilégio a vazar — a anon key já é pública | Comprometimento total: ler/alterar/apagar qualquer `profile`, `link` ou clique |
| Env novo em runtime | **Nenhum** | `SUPABASE_SERVICE_ROLE_KEY` em prod + preview (PRE-3) |
| Risco de exposição acidental | — | Um `NEXT_PUBLIC_` errado vaza a chave para o browser |
| Validação de `is_active` | **No banco**, atômica com o INSERT (não burlável) | No app, TOCTOU entre o SELECT e o INSERT |
| Round-trips | **1** (`rpc`) | 2 (SELECT + INSERT) |
| Compatível com ISR/`createPublicClient` | Sim (stateless, sem cookies) | Sim, mas exige um client novo |
| Precedente no projeto | **Sim** — `handle_new_user()` já é `SECURITY DEFINER` (migration `20260614220038`) | Não |

O argumento didático de (b) ("ensina o padrão admin client") não compensa: o Epic 6 é uma
unidade sobre **defesa em camadas e menor privilégio**, e (b) ensinaria o oposto —
resolver um problema de RLS desligando RLS. `SECURITY DEFINER` com `search_path` fixo é
o padrão canônico do Postgres/Supabase para "elevação estreita e auditável", e o projeto
já o usa. Manter `SUPABASE_SERVICE_ROLE_KEY` fora do runtime do app é o ganho de
segurança mais barato disponível neste epic.

**Consequência de processo:** PRE-3 do `EPIC-6-EXECUTION.yaml` fica **cancelado**
(condicional a (b)). `.env.example` L55 permanece como placeholder de tooling AIOX; a
Story 6.3 deve anotar ali que a chave **não** é usada pelo app Next.js.

### Desenho concreto (Story 6.3)

**Migration** `supabase/migrations/{ts}_link_clicks_rls.sql` — policies **e** `ENABLE RLS`
na mesma migration (decisão #5 do epic; nunca habilitar sem policy → lockout).

```sql
-- 1) RLS em link_clicks: append-only, ninguém escreve direto.
alter table public.link_clicks enable row level security;

-- SELECT: só o dono do link vê os cliques dele (replica a app-layer — NFR3).
create policy link_clicks_select_own on public.link_clicks
  for select to authenticated
  using (
    exists (
      select 1 from public.links l
      where l.id = link_clicks.link_id
        and l.profile_id = (select auth.uid())
    )
  );

-- Sem policy de INSERT/UPDATE/DELETE: negados por padrão para anon e authenticated.
-- (RLS habilitada sem policy = deny. O INSERT passa a ser exclusividade da RPC abaixo.)

-- 2) Rota única de escrita: eleva privilégio para UMA operação.
create or replace function public.record_link_click(
  p_link_id          uuid,
  p_user_agent_short text default null
) returns boolean
language plpgsql
security definer
set search_path = public          -- previne search_path hijack (mesmo padrão de handle_new_user)
as $$
declare
  v_active boolean;
begin
  -- Validação AUTORITATIVA no banco, atômica com o INSERT: só link existente e ativo.
  select l.is_active into v_active from public.links l where l.id = p_link_id;
  if v_active is not true then
    return false;                 -- não existe ou está inativo → no-op silencioso
  end if;

  insert into public.link_clicks (link_id, user_agent_short)
  values (p_link_id, left(p_user_agent_short, 120));   -- paridade com o CHECK (NFR19)

  return true;
end;
$$;

revoke all on function public.record_link_click(uuid, text) from public;
grant execute on function public.record_link_click(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';    -- expõe a RPC no PostgREST imediatamente
```

**Contrato da função:** retorna `boolean` (`true` = gravado), **nunca** lança para o
caller, e é a **única** porta de escrita em `link_clicks`. Não recebe nem persiste IP
(NFR19); o UA já chega truncado do app e é truncado de novo no banco (defesa em camadas).

**Refactor de `lib/actions/track-click.ts`** — o contrato público de `trackLinkClick`
não muda (valida entrada, **nunca lança**, fire-and-forget; Stories 5.2/5.3 intactas):

```ts
const supabase = createPublicClient();               // anon key, stateless → ISR preservado
const { data, error } = await supabase.rpc('record_link_click', {
  p_link_id: id,
  p_user_agent_short: userAgentShort,
});
if (error) return { ok: false, error: GENERIC_ERROR };
if (data !== true) return { ok: false, error: 'Link não encontrado ou inativo' };
return { ok: true };
```

O SELECT prévio de `links` some do app (a validação virou responsabilidade do banco):
2 round-trips → 1. `createPublicClient()` continua sendo o client — **nenhum client novo,
nenhum env novo**.

**Teste-chave (fecha o débito do Epic 5):** INSERT direto em `link_clicks` com a anon key
via PostgREST **retorna erro**; `record_link_click` com link ativo grava; com link inativo
ou inexistente retorna `false` sem gravar; SELECT anônimo de `link_clicks` não retorna linhas.

---

## 3. Decisão 2 — Rate limiting: **Supabase-native** (contadores em tabela + função SQL)

**RATIFICADA a recomendação.** Upstash e Vercel KV são **refutados** para este projeto.

### Justificativa técnica

- **Zero dependência e zero serviço novo.** Upstash/Vercel KV adicionariam SDK, conta,
  credenciais e um terceiro ponto de falha — contra o princípio zero-dep e contra NFR8
  (free tier). O Postgres do Supabase já está no caminho crítico de todos os quatro
  endpoints; se ele cair, o rate limiter é o menor dos problemas.
- **Coerência com a Decisão 1.** A mesma primitiva (`SECURITY DEFINER` + `revoke`/`grant`)
  resolve os dois problemas. Uma primitiva ensinada duas vezes vale mais, didaticamente,
  que duas tecnologias vistas de raspão.
- **Atomicidade real.** Postgres dá lock transacional e upsert atômico — a lógica de
  janela é correta sob concorrência sem gambiarra de "read-modify-write".
- **Volume compatível.** Os targets do NFR18 (5/h, 10/15min, 3/h, 60/min) somados ao
  tráfego de um biolink didático são ordens de grandeza abaixo do que uma tabela indexada
  no free tier aguenta. A latência extra é um round-trip ao mesmo banco já consultado.
- **Trade-off aceito:** Redis seria mais barato por operação em escala alta. Não é o caso
  aqui, e a migração para Upstash depois é trocar a implementação de **uma** função
  (`lib/rate-limit.ts`) — a decisão é reversível.

### Desenho concreto (Story 6.4)

**Algoritmo: janela deslizante por sub-buckets.** A janela é fatiada em sub-buckets fixos
(padrão 60s); cada requisição incrementa o bucket corrente e o consumo é a **soma dos
buckets cujo início cai dentro da janela**. Diferente do contador fixo, não permite o
pico de 2× na virada; diferente de "uma linha por evento", o custo de linhas é limitado
(`janela / bucket`, ex.: 60 linhas por chave numa janela de 1h). Simples de implementar,
de testar e de explicar — os três critérios do projeto.

**Tabela** (migration `supabase/migrations/{ts}_rate_limit.sql`):

```sql
create table public.rate_limit_counters (
  bucket       text        not null,   -- 'signup' | 'login' | 'reset' | 'track'
  subject      text        not null,   -- identidade JÁ HASHEADA — nunca IP raw (NFR19)
  window_start timestamptz not null,   -- início do sub-bucket (truncado)
  hits         int         not null default 0,
  primary key (bucket, subject, window_start)
);

create index idx_rate_limit_window_start on public.rate_limit_counters (window_start);

-- Tabela puramente interna: RLS habilitada SEM policy (deny-all) e sem grants.
-- Só a função SECURITY DEFINER abaixo a enxerga.
alter table public.rate_limit_counters enable row level security;
revoke all on table public.rate_limit_counters from anon, authenticated;
```

**Função de janela deslizante:**

```sql
create or replace function public.check_rate_limit(
  p_bucket         text,
  p_subject        text,          -- hash hex; a função NUNCA recebe IP em claro
  p_limit          int,
  p_window_seconds int,
  p_bucket_seconds int default 60
) returns boolean                 -- true = permitido (e já contabilizado); false = estourado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now          timestamptz := now();
  v_window_start timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_slot         timestamptz := to_timestamp(
                    floor(extract(epoch from v_now) / p_bucket_seconds) * p_bucket_seconds
                  );
  v_used         int;
begin
  -- Serializa por chave: check + increment viram uma operação atômica sob concorrência.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_subject, 0));

  select coalesce(sum(hits), 0) into v_used
  from public.rate_limit_counters
  where bucket = p_bucket
    and subject = p_subject
    and window_start > v_window_start;

  if v_used >= p_limit then
    return false;                 -- estourado: NÃO incrementa (não estende a punição)
  end if;

  insert into public.rate_limit_counters (bucket, subject, window_start, hits)
  values (p_bucket, p_subject, v_slot, 1)
  on conflict (bucket, subject, window_start)
    do update set hits = rate_limit_counters.hits + 1;

  -- Housekeeping oportunista (~1% das chamadas): mantém a tabela enxuta sem cron/infra.
  if random() < 0.01 then
    delete from public.rate_limit_counters
    where window_start < v_now - interval '24 hours';
  end if;

  return true;
exception when others then
  return true;                    -- FAIL-OPEN: throttle quebrado nunca derruba o produto
end;
$$;

revoke all on function public.check_rate_limit(text, text, int, int, int) from public;
grant execute on function public.check_rate_limit(text, text, int, int, int) to anon, authenticated;

notify pgrst, 'reload schema';
```

**Targets (NFR18 — fixos, não inventar outros):**

| Bucket | Limite | Janela | `p_bucket_seconds` | Chave (`subject`) |
|---|---|---|---|---|
| `signup` | 5 | 3600s | 60 | `hash(ip)` |
| `login` | 10 | 900s | 60 | `hash(ip)` |
| `reset` | 3 | 3600s | 60 | `hash(ip)` |
| `track` | 60 | 60s | 10 | `hash(ip + ':' + linkId)` |

**Comportamento no estouro** (contratado pelo epic):
- **signup / login / reset** → mensagem genérica e amigável, sem revelar o mecanismo nem
  enumerar contas (ex.: *"Muitas tentativas. Aguarde alguns minutos e tente novamente."*),
  no mesmo formato `FormState` já usado em `lib/actions/auth.ts`.
- **tracking** → **no-op silencioso**: `trackLinkClick` retorna erro tipado como sempre e
  a navegação do visitante nunca é bloqueada (contrato 5.2/5.3 preservado).
- **falha do próprio limiter** → fail-open (ver `exception` acima). Disponibilidade acima
  de throttle num produto didático; registrado aqui como trade-off consciente.

### Obtenção do IP na Vercel sem persistir IP raw (NFR19)

Na Vercel a Server Action lê os headers da request via `next/headers`. `x-forwarded-for`
é populado pela borda; o **primeiro** elemento da lista é o IP do cliente. O IP é usado
**apenas em memória** para derivar um hash — nunca é gravado, logado ou enviado ao banco.

```ts
// lib/rate-limit.ts — zero dependência: node:crypto é built-in.
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

/** IP do cliente na Vercel. Uso EFÊMERO — nunca persistido (NFR19). */
async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();   // leftmost = cliente
  return h.get('x-real-ip') ?? 'unknown';      // 'unknown' = bucket compartilhado
}

/** SHA-256 com pepper de ambiente: irreversível na prática (IPv4 é enumerável sem pepper). */
function subjectHash(...parts: string[]): string {
  const pepper = process.env.RATE_LIMIT_PEPPER ?? '';
  return createHash('sha256').update([pepper, ...parts].join(':')).digest('hex');
}
```

- Nenhuma coluna do schema armazena IP: `rate_limit_counters.subject` é sempre um digest
  hex de 64 chars, e `link_clicks` continua sem IP (NFR19 já cumprido no Epic 5).
- **`RATE_LIMIT_PEPPER`** é o único env novo do epic: string aleatória, server-only,
  **nunca** `NEXT_PUBLIC_*`. Vai ao `.env.example` (Story 6.4) e aos ambientes Vercel
  (@devops, exclusivo). Sem ele o hash ainda funciona, mas fica sujeito a enumeração do
  espaço IPv4 — daí o pepper. Contraste com a Decisão 1: o vazamento de um pepper permite
  correlacionar hashes de IP; o vazamento de uma service role key entrega o banco inteiro.
- Retenção: registros com mais de 24h são apagados pelo housekeeping — a janela mais longa
  é de 1h, então nada de valor operacional se perde.

**Uso nas Server Actions** (wrapper fino, chamado **antes** de qualquer trabalho caro):

```ts
export async function checkRateLimit(
  bucket: 'signup' | 'login' | 'reset' | 'track',
  extraKey?: string,
): Promise<boolean> { /* clientIp → subjectHash → supabase.rpc('check_rate_limit', …) */ }
```

---

## 4. Consequências

**Positivas**
- `SUPABASE_SERVICE_ROLE_KEY` **nunca** entra no runtime do app — PRE-3 cancelado e o
  item 8 do final gate ("nenhuma secret em código ou `NEXT_PUBLIC_*`") fica trivial.
- O concern MEDIUM do gate do Epic 5 é fechado por construção: sem policy de INSERT, a
  única escrita possível em `link_clicks` é a RPC que valida `is_active` no banco.
- Zero dependência nova; nenhum serviço externo; free tier preservado (NFR8).
- Uma primitiva (`SECURITY DEFINER` + `revoke`/`grant` + `search_path` fixo) usada nas
  duas stories, com precedente no próprio projeto (`handle_new_user`) — bom material didático.
- Tracking fica com 1 round-trip em vez de 2, e a validação de `is_active` deixa de ter
  janela TOCTOU.

**Negativas / riscos aceitos**
- Toda função `SECURITY DEFINER` é superfície de ataque: **obrigatórios** `SET search_path`,
  `revoke all ... from public` e `grant execute` explícito. Revisão de @data-engineer nas
  duas DDLs.
- Rate limiting acrescenta um round-trip ao banco em signup/login/reset/tracking. Aceitável
  no volume alvo; medir no gate se o tracking regredir.
- Contadores no Postgres consomem escrita do free tier (NFR8). Mitigado pelo bucket de 60s
  (agrega N cliques em 1 linha) e pelo housekeeping de 24h.
- `check_rate_limit` é **fail-open**: um limiter quebrado não bloqueia ninguém. Trade-off
  explícito de disponibilidade sobre throttle.
- Um env novo (`RATE_LIMIT_PEPPER`), não privilegiado — @devops provisiona em
  production/preview antes do merge da Story 6.4.
- `subject = 'unknown'` agrupa requests sem header de IP num balde único, que pode saturar
  e barrar terceiros legítimos. Na Vercel o header sempre existe; o caminho é só uma guarda.
- NAT/CGNAT compartilham IP — limite por IP pode afetar usuários coabitantes. É o que o
  NFR18 contratou; nada além disso será implementado (Artigo IV).

**Não-escopo (Artigo IV — No Invention):** captcha, WAF, bloqueio por conta/e-mail,
banimento persistente, pg_cron, fingerprinting de dispositivo. Nada disso está no PRD.

---

## 5. Resumo executável

| # | Decisão | Ratificada | Entrega |
|---|---|---|---|
| 1 | INSERT de tracking pós-RLS | **(a) RPC `SECURITY DEFINER`** — (b) admin client refutada | Story 6.3: RLS deny-all em `link_clicks` + `record_link_click(uuid, text) → boolean` + refactor de `track-click.ts` para `.rpc()` |
| 2 | Tecnologia de rate limiting | **Supabase-native** — Upstash/Vercel KV refutados | Story 6.4: `rate_limit_counters` + `check_rate_limit(text,text,int,int,int) → boolean` (janela deslizante por sub-buckets) + `lib/rate-limit.ts` com IP hasheado |

**Não faz parte desta decisão:** as policies de `profiles` (6.1) e `links` (6.2), já
nominadas no PRD/epic, nem o middleware/CSP (6.5).
