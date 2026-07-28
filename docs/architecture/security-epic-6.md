# ADR-001 — Segurança do Epic 6: escrita de tracking sob RLS e rate limiting

> **Status:** Aceita · **Emendada em 2026-07-19 (Emenda 1, § 6)** · **Autoridade:** `@architect` (Aria) — Design Authority
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

> ⚠️ **O bucket `track`, sozinho, NÃO fecha o vetor de click inflation** — ele só alcança
> o caminho da Server Action, e `record_link_click` é chamável direto pelo PostgREST.
> Provado empiricamente pelo gate da Wave 2. **Ver § 6 (Emenda 1)** para o desenho
> definitivo que a Story 6.4 deve implementar.

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
| 3 | Ponto de aplicação do bucket `track` (**Emenda 1, § 6**) | **Dentro da RPC**, teto por `link_id` + prova de app — `request.headers` e `p_client_key` puro refutados | Story 6.4: `drop function record_link_click(uuid,text)` (fecha a sobrecarga sem teto) + v2 `(uuid,text,text)` com `check_rate_limit('track_link', …)` + `private.app_secrets` + `revoke select … from anon` (concern #2) |

**Não faz parte desta decisão:** as policies de `profiles` (6.1) e `links` (6.2), já
nominadas no PRD/epic, nem o middleware/CSP (6.5).

---

## 6. Emenda 1 — Onde o rate limit de tracking é aplicado (2026-07-19)

> **Gatilho:** `docs/qa/gates/epic-6-wave-2-gate.yml` concerns #1 (medium) e #2 (low),
> solicitada pelo @pm antes da liberação da Story 6.4. **Altera** o § 3 (ponto de
> aplicação do bucket `track`) e o § 2 (assinatura de `record_link_click`).
> As Decisões 1 e 2 em si permanecem ratificadas.

### 6.1 O problema (empírico, não teórico)

O § 3 mandou aplicar `checkRateLimit('track', …)` dentro de `trackLinkClick` — uma Server
Action. Mas o § 2 concedeu `grant execute on record_link_click to anon`, e a função está
publicada em `POST /rest/v1/rpc/record_link_click`. **Os dois caminhos existem e só um
seria limitado.** O @qa provou: 20 chamadas `curl` diretas com a anon key pública contra
o link ativo `a22e0cf2…` levaram a contagem de 1 → 21, sem tocar no Next.js (linhas
removidas no cleanup). O desenho original fecharia a porta da frente e declararia vitória
com a dos fundos aberta.

Isso **não é regressão da 6.3** — a 6.3 estreitou o vetor de "qualquer linha arbitrária
em `link_clicks`" para "apenas links ativos legítimos, uma linha por chamada". O defeito
é do plano da 6.4, ou seja, deste ADR.

### 6.2 Verificação pedida pelo @pm: `request.headers` **não** é a saída — análise procede

O Supabase expõe os headers da requisição em `current_setting('request.headers', true)::json`.
**Confirmo a análise do @pm e acrescento um segundo motivo independente. Opção descartada
por duas razões, cada uma suficiente:**

1. **Inútil no caminho legítimo.** `trackLinkClick` usa `createPublicClient()`
   *server-side*: quem abre a conexão com o PostgREST é a função da Vercel, não o browser
   do visitante. O `x-forwarded-for` visto pelo Postgres é o **IP de egresso da Vercel**.
   Um limite por esse valor colapsaria **todo** o tráfego legítimo do produto num único
   bucket global — o rate limiter viraria um interruptor de desligar o tracking inteiro
   no primeiro minuto movimentado.
2. **Forjável no caminho hostil.** Quem chama o PostgREST direto controla os próprios
   headers e pode variar `x-forwarded-for` a cada request. O único cliente cujo IP o
   banco enxergaria de forma confiável é justamente o que não queremos limitar.

Pelo mesmo motivo, **`p_client_key` vindo do cliente também está descartado como chave
única**: um atacante direto geraria um subject aleatório por chamada e evadiria o limite
integralmente. Só serve se combinado com prova de que o chamador é o app (§ 6.3, camada 3).

### 6.3 Decisão: mover o teto para dentro da RPC, com chave que o banco controla

O limite tem de ser avaliado **onde as duas rotas convergem — dentro de
`record_link_click`** — e chaveado por algo que o banco conheça de forma autoritativa e
que o chamador não escolha. Só existe um candidato: **`p_link_id`**, que é exatamente o
recurso sendo inflado. Três camadas:

| # | Camada | Onde | Chave | Alcança o curl direto? |
|---|---|---|---|---|
| 1 | Teto por link (**backstop**) | dentro da RPC | `link_id` (do banco) | **Sim — sempre** |
| 2 | Limite por visitante (NFR18) | Server Action | `hash(ip + ':' + linkId)` | Não (por desenho) |
| 3 | Prova de app | dentro da RPC | segredo server-only | Dimensiona o teto da camada 1 |

**Camada 3 é o que separa os dois caminhos.** A anon key é pública por definição (vai no
bundle do browser) — ela não distingue ninguém. Mas `trackLinkClick` roda no servidor e
pode enviar um segredo que o browser **nunca** vê. Chamador com o segredo correto =
servidor da Vercel → teto generoso. Chamador sem ele = qualquer um com a anon key → teto
apertado. É a mesma filosofia da Decisão 1 (privilégio estreito): o segredo autoriza
**uma** coisa — um teto maior nesta RPC — e não é uma chave de bypass do banco como a
service role key, que segue refutada.

**Por que não simplesmente `revoke execute from anon`:** o app se autentica no PostgREST
*como* `anon` (é a anon key no `createPublicClient`). Revogar quebra o caminho legítimo.
Usar outro papel exigiria service role (refutada) ou assinar JWT customizado com o JWT
secret do projeto — que permite forjar um token `service_role` e portanto é *mais*
perigoso que a chave que recusamos. Descartado.

**Artigo IV (No Invention):** o teto por link **não é um controle novo**. É o rate
limiting de tracking que o NFR18 já contratou, realocado para o único ponto de aplicação
que cobre todos os chamadores. Nenhum controle fora do PRD é introduzido (nada de captcha,
fingerprint ou bloqueio de conta).

**Limites (o de visitante é literal do NFR18; os tetos por link são dimensionamento):**

| Camada | Limite | Janela | Justificativa |
|---|---|---|---|
| 2 — por visitante | **60** / `(ip, linkId)` | 60s | NFR18 verbatim, inalterado |
| 1 — teto por link, chamador **confiável** | **600** / `linkId` | 60s | 10× de folga para um link legitimamente viral, e ainda um teto duro protegendo o free tier (NFR8) |
| 1 — teto por link, chamador **não confiável** | **60** / `linkId` | 60s | Um anônimo direto não recebe mais do que um único visitante teria direito |

### 6.4 SQL concreto para a Story 6.4

**(a) Cofre do segredo — schema privado, invisível a `anon`/`authenticated`.**
O segredo **não** entra na migration (o repositório é público): a tabela nasce vazia e é
sempre o *hash* que se armazena, nunca o valor.

```sql
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_secrets (
  name          text primary key,
  secret_sha256 text        not null,   -- SHA-256 hex do segredo, NUNCA o segredo
  updated_at    timestamptz not null default now()
);

-- Sem policy = negação total. Só funções SECURITY DEFINER enxergam esta tabela.
alter table private.app_secrets enable row level security;
revoke all on table private.app_secrets from anon, authenticated;
```

Seeding fora do versionamento (@devops, dev + prod), com o valor de `TRACKING_APP_PROOF`:

```sql
insert into private.app_secrets (name, secret_sha256)
values ('tracking_app_proof', encode(digest('<valor-do-env>', 'sha256'), 'hex'))
on conflict (name) do update
  set secret_sha256 = excluded.secret_sha256, updated_at = now();
```

**(b) `record_link_click` v2 — o teto passa a ser avaliado aqui.**

> 🔴 **`drop function` da assinatura antiga é OBRIGATÓRIO.** Adicionar um parâmetro com
> default **cria uma sobrecarga**: a função `(uuid, text)` continuaria existindo,
> `grant execute to anon`, **sem teto nenhum** — o bypass permaneceria publicado.
> Derrubar a antiga é o passo que efetivamente fecha o vetor.

```sql
-- Fecha a sobrecarga sem teto. Ver aviso acima — não é higiene, é a correção.
drop function if exists public.record_link_click(uuid, text);

create or replace function public.record_link_click(
  p_link_id          uuid,
  p_user_agent_short text default null,
  p_app_proof        text default null   -- segredo server-only; ausente = não confiável
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active   boolean;
  v_expected text;
  v_trusted  boolean := false;
  v_limit    int;
begin
  select l.is_active into v_active from public.links l where l.id = p_link_id;
  if v_active is not true then
    return false;                      -- inexistente ou inativo → no-op (inalterado)
  end if;

  -- Camada 3: só o servidor Next.js conhece o segredo. A anon key, que é pública,
  -- não prova nada. Comparação por hash: um dump do banco não entrega o segredo.
  select s.secret_sha256 into v_expected
  from private.app_secrets s
  where s.name = 'tracking_app_proof';

  v_trusted := v_expected is not null
               and p_app_proof is not null
               and encode(digest(p_app_proof, 'sha256'), 'hex') = v_expected;

  v_limit := case when v_trusted then 600 else 60 end;

  -- Camada 1: teto por LINK, avaliado em TODA chamada — Server Action ou curl direto.
  -- subject = link_id (uuid, não é PII): NFR19 não se aplica, nada a hashear.
  if not public.check_rate_limit('track_link', p_link_id::text, v_limit, 60, 10) then
    return false;                      -- estourou → no-op silencioso (contrato 5.2)
  end if;

  insert into public.link_clicks (link_id, user_agent_short)
  values (p_link_id, left(p_user_agent_short, 120));

  return true;
end;
$$;

revoke all on function public.record_link_click(uuid, text, text) from public;
grant execute on function public.record_link_click(uuid, text, text) to anon, authenticated;
```

**(c) Concern #2 do gate — simetria de leitura em `link_clicks`.**
O bloco (e) da migration da 6.3 argumenta que o GRANT deve ser revogado como segunda
camada mesmo quando a RLS já nega; o raciocínio vale igual para o SELECT e não foi
aplicado. A escrita tem duas camadas, a leitura só tinha uma:

```sql
revoke select, references, trigger on public.link_clicks from anon;
revoke references, trigger on public.link_clicks from authenticated;
```

`authenticated` **mantém o SELECT** — ele é exigido pela view `link_click_daily` com
`security_invoker = on` (bloco (d) da migration da 6.3). Revogá-lo derrubaria o dashboard
de analytics.

```sql
notify pgrst, 'reload schema';
```

**(d) `lib/actions/track-click.ts` — camada 2 preservada, proof adicionado:**

```ts
// Camada 2 (NFR18): precisa do IP do visitante, que só existe aqui. Antes da RPC.
if (!(await checkRateLimit('track', id))) return { ok: false, error: GENERIC_ERROR };

const { data, error } = await supabase.rpc('record_link_click', {
  p_link_id: id,
  p_user_agent_short: userAgentShort,
  p_app_proof: process.env.TRACKING_APP_PROOF ?? null,   // server-only, nunca NEXT_PUBLIC_*
});
```

**(e) Ordem de deploy — sem janela de quebra.** O `drop function` derruba a assinatura de
2 argumentos, mas o app antigo (ainda em produção durante a migration) chama com
`p_link_id` + `p_user_agent_short`, e a v2 aceita essa chamada porque `p_app_proof` tem
default. O tracking continua gravando na janela entre a migration e o deploy da Vercel —
apenas como **não confiável** (teto de 60/min/link). Nenhum clique legítimo se perde em
tráfego normal. Mesma propriedade se `TRACKING_APP_PROOF` ficar sem seed: degrada para o
teto apertado em vez de quebrar o tracking (**falha degradando, não abrindo**).

**(f) Testes que a 6.4 deve ter** (o gate provou o vetor com curl; a suíte precisa provar
o fechamento): 61 chamadas diretas à RPC **sem** `p_app_proof` contra um link ativo →
60 gravam, a 61ª retorna `false` sem inserir; a mesma sequência **com** o proof correto
respeita o teto de 600; `select` no catálogo confirma que a sobrecarga `(uuid, text)`
não existe mais; `GET /rest/v1/link_clicks` com anon key → `permission denied` (não mais
`200 []`), fechando o concern #2.

### 6.5 O que permanece descoberto (aceito, com justificativa)

O vetor é **fechado como bypass** (nenhum caminho escapa do teto) e **bounded como abuso**
— não é eliminado. Explicitamente:

1. **Inflação até o teto continua possível.** Um atacante direto ainda pode gravar
   60 cliques/min/link (~86k/dia) sem passar pelo Next.js. Rate limiting limita
   **volume**, nunca **autenticidade** — nenhum ajuste de limite torna um clique forjado
   distinguível de um real. Distinguir exigiria prova de humanidade por visitante
   (captcha), **fora do PRD** (Artigo IV, não-escopo do epic). Aceito.
2. **Vazamento de `TRACKING_APP_PROOF`** (comprometimento do servidor, log de env,
   import acidental em Client Component) eleva o atacante ao teto de 600/min. Continua
   limitado; e o dano é incomparavelmente menor que o da service role key recusada na
   Decisão 1.
3. **Link legitimamente viral acima de 600 cliques/min subnotifica.** Cliques acima do
   teto não são enfileirados nem repostos — a analytics passa a ser um piso, não um
   total. É o preço consciente de ter um teto; para este produto, proteger o free tier
   (NFR8) vale mais que precisão em cauda extrema.
4. **Ataque distribuído evade a camada 2 por construção** (muitos IPs, cada um abaixo de
   60/min). É exatamente por isso que a camada 1 não é chaveada por IP.
5. **A camada 1 herda o fail-open de `check_rate_limit`** (§ 3): um erro interno do
   limiter libera as escritas. Mantido por consistência com signup/login, onde
   disponibilidade pesa mais. Um limiter quebrado degrada para o comportamento pós-6.3
   — que já é melhor que o do MVP.
6. **Contenção do advisory lock por link.** Todo clique no mesmo link serializa no
   `pg_advisory_xact_lock` da chave `track_link:<uuid>`. O lock é de escopo de transação
   e dura microssegundos, mas é o ponto quente previsível se um link viralizar.
7. **Um segundo env server-only** (`TRACKING_APP_PROOF`, além de `RATE_LIMIT_PEPPER`) e
   um passo de seeding **fora do versionamento** em dois ambientes. É drift operacional
   possível; mitigado pela degradação segura do item (e).

**Julgamento:** o custo (uma tabela privada, um env, um seed) é materialmente menor que o
da alternativa que já recusamos na Decisão 1, e o vetor deixa de ser um bypass silencioso.
**Não recomendo aceitar o débito puro** (opção (c) do gate): declarar "rate limiting
entregue" com o caminho direto aberto é pior que não entregar, porque cria confiança
indevida. Os resíduos acima são limites do que rate limiting *pode* fazer — não buracos
no desenho.
