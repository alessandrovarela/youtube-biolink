-- Story 6.4 — Rate limiting (signup, login, reset, tracking).
--
-- Fonte: PRD FR21 (L66) · NFR18 (L90) · NFR19 (L92) · NFR8 (L82)
--        · docs/architecture/security-epic-6.md — ADR-001 § 3 (Decisão 2: Supabase-native)
--          e § 6 (EMENDA 1: onde o rate limit de tracking é aplicado)
--        · docs/qa/gates/epic-6-wave-2-gate.yml — concern #1 (medium) e concern #2 (low)
--        · arbitragem do @pm sobre a Emenda 1 (ver bloco "CAMADA 3 DESCARTADA" abaixo).
--
-- ORDEM OBRIGATÓRIA (decisão #5a do epic): tabela, RLS, revokes, função, grants e o
-- teto dentro de record_link_click vivem no MESMO arquivo. A migration roda em
-- transação: não existe janela com a tabela criada sem a RLS que a torna privada, nem
-- com a RPC publicada sem o teto que a protege.
--
-- ┌──────────────────────────────────────────────────────────────────────────────┐
-- │ O QUE ESTA MIGRATION FECHA                                                    │
-- └──────────────────────────────────────────────────────────────────────────────┘
-- O gate da Wave 2 PROVOU por probe que `checkRateLimit('track', ...)` dentro da
-- Server Action `trackLinkClick` NÃO fecha o vetor de click inflation: a RPC
-- `record_link_click` é `grant execute to anon` e está publicada em
-- POST /rest/v1/rpc/record_link_click. 20 chamadas curl diretas com a anon key
-- pública gravaram 20 cliques forjados sem tocar no Next.js.
--
-- A correção é mover o teto para DENTRO da RPC — o único ponto onde as duas rotas
-- (Server Action e PostgREST direto) convergem — chaveado por algo que o banco conhece
-- de forma autoritativa e que o chamador não escolhe: o próprio `p_link_id`.
--
-- ┌──────────────────────────────────────────────────────────────────────────────┐
-- │ CAMADA 3 (app-proof) DESCARTADA POR ARBITRAGEM DO @pm                         │
-- └──────────────────────────────────────────────────────────────────────────────┘
-- O § 6 do ADR propôs TRÊS camadas; a terceira (um segredo server-only em
-- `private.app_secrets` que elevaria o teto de 60 para 600 quando o chamador provasse
-- ser o app) foi DESCARTADA. Motivo: o resultado de SEGURANÇA é idêntico com ou sem
-- ela — o atacante direto grava 60/min/link nos dois desenhos. Ela só compraria folga
-- para um link legitimamente viral, ao custo de um segredo semeado à mão FORA do
-- versionamento em dois ambientes (drift operacional garantido num projeto didático).
-- Simplicidade didática prevalece. Consequência: teto ÚNICO de 60/min por link para
-- TODOS os chamadores, e a assinatura de record_link_click NÃO muda.
--
-- ┌──────────────────────────────────────────────────────────────────────────────┐
-- │ POR QUE NÃO HÁ `drop function` AQUI (e por que isso é seguro)                  │
-- └──────────────────────────────────────────────────────────────────────────────┘
-- O § 6.4(b) do ADR exige `drop function` porque a v2 dele ACRESCENTAVA um parâmetro
-- (`p_app_proof`) — e um parâmetro novo com default cria uma SOBRECARGA: a assinatura
-- antiga `(uuid, text)` continuaria existindo, `grant execute to anon` e SEM TETO,
-- deixando o bypass publicado. Sem a camada 3, a assinatura permanece EXATAMENTE
-- `(uuid, text)`, então `create or replace` SUBSTITUI o corpo da mesma função e
-- nenhuma sobrecarga é criada. Verificação obrigatória pós-migration: o catálogo deve
-- conter EXATAMENTE UMA `public.record_link_click` (ver tests/integration/rate-limit.test.ts).

-- ══════════════════════════════════════════════════════════════════════════════
-- 1) Contadores — tabela PURAMENTE INTERNA.
-- ══════════════════════════════════════════════════════════════════════════════
-- `subject` NUNCA é um IP: é sempre um digest hex de 64 chars derivado no app com
-- SHA-256 + pepper (NFR19), ou — no caso do teto por link — o próprio `link_id`, que
-- é um uuid e não é PII. Nenhuma coluna deste schema armazena IP raw.
create table public.rate_limit_counters (
  bucket       text        not null,   -- 'signup' | 'login' | 'reset' | 'track' | 'track_link'
  subject      text        not null,   -- identidade JÁ HASHEADA (ou link_id) — nunca IP raw
  window_start timestamptz not null,   -- início do sub-bucket (truncado)
  hits         int         not null default 0,
  primary key (bucket, subject, window_start)
);

-- Suporta o housekeeping oportunista (varredura por idade).
create index idx_rate_limit_window_start on public.rate_limit_counters (window_start);

-- RLS habilitada SEM policy = negação total, e sem grants nenhum. Só a função
-- SECURITY DEFINER abaixo (que roda como o owner) enxerga esta tabela. Um cliente com
-- a anon key não lê nem escreve aqui — nem para descobrir quanto do limite já gastou.
alter table public.rate_limit_counters enable row level security;
revoke all on table public.rate_limit_counters from anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2) check_rate_limit — janela deslizante por sub-buckets.
-- ══════════════════════════════════════════════════════════════════════════════
-- Retorna true = permitido (E JÁ CONTABILIZADO); false = estourado.
--
-- Por que sub-buckets: a janela é fatiada em fatias fixas (p_bucket_seconds) e o
-- consumo é a SOMA das fatias cujo início cai dentro da janela. Diferente do contador
-- fixo, não permite o pico de 2x na virada; diferente de "uma linha por evento", o
-- custo de linhas é limitado a (janela / bucket) por chave.
--
-- Os três controles obrigatórios de SECURITY DEFINER (ADR-001 § 4) estão aplicados:
--   a) `set search_path = public` — impede search_path hijack;
--   b) `revoke all ... from public` — remove o EXECUTE implícito de PUBLIC;
--   c) `grant execute ... to anon, authenticated` — allowlist explícita e mínima.
create or replace function public.check_rate_limit(
  p_bucket         text,
  p_subject        text,          -- hash hex (ou uuid); a função NUNCA recebe IP em claro
  p_limit          int,
  p_window_seconds int,
  p_bucket_seconds int default 60
) returns boolean
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
  -- Serializa por chave: o check e o increment viram UMA operação atômica sob
  -- concorrência, sem read-modify-write frágil. É o ganho de rodar no Postgres em vez
  -- de num KV eventualmente consistente. Lock de escopo de transação — liberado no
  -- commit, dura microssegundos.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_subject, 0));

  select coalesce(sum(hits), 0) into v_used
  from public.rate_limit_counters
  where bucket = p_bucket
    and subject = p_subject
    and window_start > v_window_start;

  -- ESTOUROU: retorna false SEM INCREMENTAR. Se cada requisição bloqueada também
  -- contasse, um cliente em loop estenderia a própria punição indefinidamente e a
  -- janela nunca esvaziaria. [ADR-001 § 3]
  if v_used >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_counters (bucket, subject, window_start, hits)
  values (p_bucket, p_subject, v_slot, 1)
  on conflict (bucket, subject, window_start)
    do update set hits = rate_limit_counters.hits + 1;

  -- Housekeeping oportunista (~1% das chamadas): mantém a tabela enxuta sem pg_cron e
  -- sem infra adicional. A janela mais longa em uso é de 1h, então nada de valor
  -- operacional se perde ao apagar o que tem mais de 24h.
  if random() < 0.01 then
    delete from public.rate_limit_counters
    where window_start < v_now - interval '24 hours';
  end if;

  return true;
exception when others then
  -- FAIL-OPEN — ESCOLHA CONSCIENTE, NÃO DEFEITO.
  -- Um limiter quebrado (deadlock, tabela ausente, erro de tipo) NUNCA derruba o
  -- produto: ele libera. Trade-off explícito de DISPONIBILIDADE acima de THROTTLE num
  -- produto didático. O @qa não deve tratar isto como bug: está contratado no
  -- ADR-001 § 3/§ 4 e na AC5/AC14 da Story 6.4. O custo de errar para o lado fechado
  -- seria não conseguir logar nem cadastrar; o custo de errar para o aberto é voltar
  -- ao comportamento pré-6.4, que já era o do MVP inteiro.
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, text, int, int, int) from public;
grant execute on function public.check_rate_limit(text, text, int, int, int) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3) record_link_click v2 — o teto por LINK passa a ser avaliado AQUI.
-- ══════════════════════════════════════════════════════════════════════════════
-- MESMA ASSINATURA (uuid, text) da Story 6.3 → `create or replace` substitui o corpo,
-- não cria sobrecarga. Ver o bloco de comentário no topo do arquivo.
--
-- Camada 1 (backstop, esta função): teto de 60 cliques/min POR LINK, avaliado em TODA
-- chamada — venha ela da Server Action ou de um curl direto ao PostgREST. É o que
-- fecha o vetor provado pelo gate da Wave 2.
-- Camada 2 (Server Action, lib/rate-limit.ts): 60/min por (ip, linkId) — NFR18
-- verbatim. Não alcança o curl direto POR DESENHO: a RPC não enxerga o IP do
-- visitante (quem abre a conexão com o PostgREST é a função da Vercel).
--
-- subject = link_id: é um uuid, não é PII — NFR19 não se aplica, nada a hashear. E é
-- a única chave que o BANCO conhece de forma autoritativa e que o chamador não escolhe.
create or replace function public.record_link_click(
  p_link_id          uuid,
  p_user_agent_short text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
begin
  select l.is_active into v_active
  from public.links l
  where l.id = p_link_id;

  -- Link inexistente (v_active is null) ou inativo → no-op silencioso (inalterado).
  if v_active is not true then
    return false;
  end if;

  -- TETO POR LINK — 60/min, sub-buckets de 10s, para TODOS os chamadores.
  -- Estourou → no-op silencioso, mesmo contrato do link inativo (a Server Action
  -- traduz para { ok:false } e a navegação do visitante nunca é bloqueada).
  if not public.check_rate_limit('track_link', p_link_id::text, 60, 60, 10) then
    return false;
  end if;

  insert into public.link_clicks (link_id, user_agent_short)
  values (p_link_id, left(p_user_agent_short, 120));

  return true;
end;
$$;

revoke all on function public.record_link_click(uuid, text) from public;
grant execute on function public.record_link_click(uuid, text) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4) Concern #2 do gate da Wave 2 — simetria de leitura em link_clicks.
-- ══════════════════════════════════════════════════════════════════════════════
-- O bloco (e) da migration da 6.3 revoga insert/update/delete/truncate de anon com a
-- justificativa "se um dia alguém adicionar uma policy permissiva por engano, o
-- privilégio ainda não estará lá". O raciocínio vale IDENTICAMENTE para o SELECT e não
-- tinha sido aplicado: a escrita tinha duas camadas (RLS + ausência de grant), a
-- leitura tinha só uma (RLS). Corrigido aqui.
revoke select, references, trigger on public.link_clicks from anon;

-- ⚠️ `authenticated` MANTÉM O SELECT. Ele é EXIGIDO pela view link_click_daily com
--    security_invoker = on (bloco (d) da migration da 6.3): com a view rodando sob o
--    privilégio do chamador, o dashboard precisa de SELECT na TABELA BASE. Revogar
--    aqui derrubaria o analytics com "permission denied for table link_clicks".
--    Só o ruído do default do Supabase (references/trigger) sai.
revoke references, trigger on public.link_clicks from authenticated;

-- Recarrega o schema cache do PostgREST: publica check_rate_limit, republica o novo
-- corpo de record_link_click e aplica os revokes imediatamente.
notify pgrst, 'reload schema';
