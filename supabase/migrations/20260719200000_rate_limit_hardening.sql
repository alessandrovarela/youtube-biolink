-- Story 6.4 (correção) — o limiter deixa de ser uma primitiva de ESCRITA remota.
--
-- Fonte: docs/qa/gates/epic-6-wave-3-gate.yml — issue #1 (HIGH), #2 (MEDIUM), #3 (LOW)
--        · docs/architecture/security-epic-6.md — ADR-001 § 3 e § 4 (Emenda 1, § 6)
--        · PRD FR21 (L66) · NFR18 (L90) · NFR19 (L92) · NFR8 (L82)
--
-- ⚠️ MIGRATION NOVA, NÃO EDIÇÃO. A 20260719190000_rate_limit.sql JÁ ESTÁ APLICADA em
--    development. Reescrever migration aplicada produz drift entre o histórico e o
--    banco — mesmo precedente da Story 6.3. Aqui só se ACRESCENTA e se CORRIGE por cima.
--
-- ┌──────────────────────────────────────────────────────────────────────────────┐
-- │ O DEFEITO QUE ESTA MIGRATION FECHA (issue #1, HIGH)                           │
-- └──────────────────────────────────────────────────────────────────────────────┘
-- A migration anterior concedeu `grant execute on check_rate_limit to anon` porque
-- lib/rate-limit.ts fala com o PostgREST usando a anon key. Só que a função recebe
-- p_bucket, p_subject, p_limit, p_window_seconds e p_bucket_seconds INTEIRAMENTE do
-- chamador e ESCREVE na tabela de contadores. Isso a converteu numa primitiva de
-- escrita remota: um mecanismo defensivo virou arma contra o próprio produto.
--
-- O gate da Wave 3 provou três abusos, todos com a anon key pública e sem tocar no
-- Next.js:
--   (a) SUPRESSÃO DE ANALYTICS — 60 chamadas a check_rate_limit('track_link', <link_id>)
--       esgotam o balde de um link de TERCEIRO sem gravar UM ÚNICO clique; o clique
--       legítimo seguinte é recusado. O pepper não protege: o subject ali é o link_id,
--       que é PÚBLICO por design (policy links_select_public_active).
--   (b) LOCKOUT DE AUTENTICAÇÃO — com o pepper vazio, o subject de auth é
--       sha256(':' || ip), computável por qualquer um: 10 requisições anônimas negam
--       login a um IP arbitrário por 15 minutos.
--   (c) BUCKETS ARBITRÁRIOS — 'lixo', 'qa_gate_probe'… todos aceitos e persistidos.
--       (bucket, subject) livres = crescimento irrestrito de rate_limit_counters, e o
--       housekeeping só varre o que tem mais de 24h. Pressão de armazenamento no free
--       tier, contra o NFR8.
--
-- Balanço honesto do gate: a story LIMITOU a inflação de cliques e ABRIU a supressão.
-- Aproximadamente uma troca, não um ganho líquido. Esta migration desfaz a troca.
--
-- ┌──────────────────────────────────────────────────────────────────────────────┐
-- │ O DESENHO DA CORREÇÃO                                                         │
-- └──────────────────────────────────────────────────────────────────────────────┘
-- A raiz do defeito é UMA decisão: expor a primitiva genérica. A correção é a
-- recomendação (a) do gate — mais forte que a (b) —, que separa CAPACIDADE de POLÍTICA:
--
--   check_rate_limit(...)      → mecanismo. INTERNA. Nenhum cliente HTTP a alcança.
--   check_app_rate_limit(2 args) → política. PÚBLICA, mas o chamador só escolhe QUEM
--                                  ele é (o subject); o QUANTO é do banco.
--
-- Isso é o princípio do menor privilégio aplicado a uma função: o chamador recebe
-- exatamente a autoridade de que precisa (consumir a própria cota) e nem um grau a
-- mais (definir a cota, escolher o balde, atingir balde alheio).
--
-- ┌──────────────────────────────────────────────────────────────────────────────┐
-- │ POR QUE O REVOKE NÃO QUEBRA record_link_click                                 │
-- └──────────────────────────────────────────────────────────────────────────────┘
-- `record_link_click` é SECURITY DEFINER: seu corpo executa com os privilégios do
-- OWNER (postgres), não os do chamador. A verificação de EXECUTE em
-- check_rate_limit é feita contra o usuário CORRENTE naquele ponto — que dentro de uma
-- função SECURITY DEFINER é o owner. Por isso a camada 1 (teto de 60/min/link) continua
-- funcionando intacta mesmo depois de anon perder o EXECUTE. É exatamente esse fato que
-- torna o desenho viável, e ele foi CONFIRMADO EMPIRICAMENTE após aplicar esta migration
-- (61 chamadas diretas ao PostgREST: 60 aceitas, a 61ª barrada).

-- ══════════════════════════════════════════════════════════════════════════════
-- 1) check_rate_limit — mesma assinatura, duas correções.
-- ══════════════════════════════════════════════════════════════════════════════
-- Correção 1 (issue #3, LOW): o bloco DECLARE ficava FORA do `exception when others`,
-- então exceções na INICIALIZAÇÃO das variáveis propagavam ao chamador em vez de virar
-- `true`. Provado pelo gate: p_bucket_seconds=0 devolvia 22012 "division by zero" (HTTP
-- 400) e não o fail-open que a AC5/AC14 e o comentário didático prometiam. Agora as
-- variáveis são apenas DECLARADAS e a ATRIBUIÇÃO acontece dentro do bloco protegido —
-- o fail-open passa a ser realmente total, e o comentário volta a descrever o código
-- com exatidão. O gate pediu explicitamente "preferir corrigir o código a ajustar a
-- afirmação": é o que se faz aqui.
--
-- Correção 2 (issue #1): a função continua idêntica em COMPORTAMENTO. O que muda é
-- QUEM pode chamá-la — ver o bloco de revoke logo abaixo.
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
  -- SEM INICIALIZADORES DE PROPÓSITO (issue #3): tudo o que pode lançar mora dentro do
  -- `begin`, sob o guarda-chuva do exception handler.
  v_now          timestamptz;
  v_window_start timestamptz;
  v_slot         timestamptz;
  v_used         int;
begin
  v_now          := now();
  v_window_start := v_now - make_interval(secs => p_window_seconds);
  -- Esta linha é a que lançava 22012 com p_bucket_seconds = 0. Agora o fail-open a cobre.
  v_slot         := to_timestamp(
                      floor(extract(epoch from v_now) / p_bucket_seconds) * p_bucket_seconds
                    );

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
  -- Um limiter quebrado (deadlock, tabela ausente, erro de tipo, divisão por zero)
  -- NUNCA derruba o produto: ele libera. Trade-off explícito de DISPONIBILIDADE acima
  -- de THROTTLE num produto didático. Contratado no ADR-001 § 3/§ 4 e na AC5/AC14.
  -- Desde esta migration a afirmação vale para a função INTEIRA, não só para parte
  -- dela (issue #3 do gate da Wave 3).
  return true;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2) 🔴 check_rate_limit passa a ser INTERNA — o coração da correção.
-- ══════════════════════════════════════════════════════════════════════════════
-- Nenhum cliente HTTP alcança mais a primitiva genérica. Sobram como chamadores:
--   • o OWNER, de dentro de funções SECURITY DEFINER (record_link_click e o wrapper
--     abaixo) — é assim que as duas camadas continuam funcionando;
--   • service_role, que já bypassa tudo por definição e é usado só por tooling/testes.
-- `anon` e `authenticated` perdem o acesso direto. O PostgREST continua listando a
-- função no schema cache, mas toda chamada volta 42501 permission denied.
revoke all on function public.check_rate_limit(text, text, int, int, int) from public;
revoke all on function public.check_rate_limit(text, text, int, int, int) from anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3) check_app_rate_limit — a ÚNICA porta pública, e ela é estreita.
-- ══════════════════════════════════════════════════════════════════════════════
-- As Server Actions (signup/login/reset e a camada 2 do tracking) rodam na Vercel e
-- falam com o PostgREST usando a ANON KEY — elas precisam de ALGUM caminho. Este é o
-- caminho, e ele carrega o mínimo de autoridade possível:
--
--   1. ALLOWLIST DE BUCKET. Só 'signup' | 'login' | 'reset' | 'track'. Qualquer outro
--      valor levanta exceção ANTES de qualquer escrita. Fecha (c): não há mais como
--      criar linhas em buckets inventados, e — o que mais importa — 'track_link' NÃO
--      está na lista, então o balde por link (o vetor (a)) ficou inalcançável de fora.
--   2. LIMITES HARDCODED. limit/window/bucket_seconds saem de um CASE aqui dentro, com
--      os valores do NFR18. O chamador NÃO os escolhe. Some o "p_limit=999999" e some
--      o "p_window_seconds=86401" que furava a margem do housekeeping.
--   3. FORMATO DO SUBJECT VALIDADO. Tem que ser digest hex de 64 chars — a forma que
--      lib/rate-limit.ts sempre produz. Um uuid, um IP em claro ou uma string de 10 MB
--      são recusados. É NFR19 virando invariante do BANCO, e não só promessa do app.
--
-- O QUE ESTA FUNÇÃO NÃO RESOLVE, E POR QUÊ: o `subject` continua vindo do app, porque
-- só o app enxerga o IP do visitante (na RPC o IP visível seria o de egresso da Vercel,
-- que colapsaria todo o tráfego num balde global). Logo, quem CONSEGUIR COMPUTAR o
-- subject de uma vítima ainda pode gastar o balde dela — o vetor (b). O que impede isso
-- é o pepper: sem ele o hash é uma função pública; com ele o atacante precisaria
-- adivinhar um segredo de 256 bits. Por isso RATE_LIMIT_PEPPER deixou de ser reforço de
-- privacidade e virou CONTROLE DE SEGURANÇA obrigatório — lib/rate-limit.ts agora
-- RECUSA subir em produção sem ele (issue #2 do gate).
--
-- Os três controles obrigatórios de SECURITY DEFINER (ADR-001 § 4) estão aplicados:
-- search_path fixo, PUBLIC revogado, grant explícito mínimo.
create or replace function public.check_app_rate_limit(
  p_bucket  text,
  p_subject text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit          int;
  v_window_seconds int;
  v_bucket_seconds int;
begin
  -- ⚠️ SEM `exception when others` AQUI, DE PROPÓSITO. Se a validação levantasse e o
  --    handler a engolisse, um bucket inválido viraria `true` silencioso — o oposto de
  --    uma allowlist. A rejeição precisa ser VISÍVEL (HTTP 400). O fail-open do produto
  --    continua garantido nas duas pontas certas: dentro de check_rate_limit (falha do
  --    MECANISMO) e em lib/rate-limit.ts (falha de rede/RPC). Falha de POLÍTICA é bug de
  --    programação e deve gritar.

  -- Targets do NFR18 — a autoridade sobre "quanto" mora AQUI, não no chamador.
  case p_bucket
    when 'signup' then v_limit :=  5; v_window_seconds := 3600; v_bucket_seconds := 60;
    when 'login'  then v_limit := 10; v_window_seconds :=  900; v_bucket_seconds := 60;
    when 'reset'  then v_limit :=  3; v_window_seconds := 3600; v_bucket_seconds := 60;
    when 'track'  then v_limit := 60; v_window_seconds :=   60; v_bucket_seconds := 10;
    else
      raise exception 'check_app_rate_limit: bucket % nao permitido', p_bucket
        using errcode = '22023';   -- invalid_parameter_value
  end case;

  -- NFR19 como invariante do banco: só entra digest hex de 64 chars. Bloqueia IP em
  -- claro, uuid (o vetor (a)) e payload arbitrário grande.
  if p_subject is null or p_subject !~ '^[0-9a-f]{64}$' then
    raise exception 'check_app_rate_limit: subject deve ser um digest hex de 64 chars'
      using errcode = '22023';
  end if;

  return public.check_rate_limit(p_bucket, p_subject, v_limit, v_window_seconds, v_bucket_seconds);
end;
$$;

revoke all on function public.check_app_rate_limit(text, text) from public;
grant execute on function public.check_app_rate_limit(text, text) to anon, authenticated;

-- Recarrega o schema cache do PostgREST: publica check_app_rate_limit e aplica o
-- revoke de check_rate_limit imediatamente.
notify pgrst, 'reload schema';
