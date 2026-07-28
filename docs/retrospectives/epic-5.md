# Retrospectiva — Epic 5: Analytics de Cliques

**Data:** 2026-07-19 (escrita em atraso — ver "O que pode melhorar")
**Agentes:** @pm (Morgan), @dev (Dex), @qa (Quinn), @ux-design-expert (Uma)
**Duração do epic:** sessão única, 4 waves em modo YOLO (subagentes sequenciais no mesmo working tree)

Último pilar didático do MVP: tracking server-side fire-and-forget, agregação por link e por dia, dashboard com tabela + gráfico temporal. Com o Epic 5 o produto ficou **funcionalmente completo** (6 pilares) — mas, como esta retro registra, "funcionalmente completo" não é a mesma coisa que "MVP declarado pronto".

---

## O que funcionou bem

- **A decisão de gráfico zero-dep (SVG inline) se pagou — com uma ressalva honesta.** O PRD delegava a escolha ao @architect e sugeria `recharts`/`tremor`; a reconciliação pré-execução (decisão #1 do EPIC-5-EXECUTION) optou por SVG inline com os tokens do Epic 4. Resultado: `package.json` **intacto**, gráfico server-rendered com geometria pré-computada, zero peso de bundle, e helpers puros (`lib/analytics/chart.ts`) testáveis sem DOM — o QA registrou cobertura de vazio, ponto único e `max=0`. Coerente com o padrão do projeto (sem zod, `cn` local, sem lib de UI). **Ressalva:** o gate já apontava `preserveAspectRatio="none"` como concern info "cosmético", e o Epic 6 provou que não era: em largura de mobile o viewBox 720×240 comprimia a ~54% na horizontal, condensando anamorficamente os rótulos dos eixos. Ou seja, a decisão de arquitetura foi certa, mas **entregamos o SVG sem um teste de responsividade** e a etiqueta "cosmético" atrasou o conserto em um epic inteiro. O fix final (`w-full h-auto`, sem `preserveAspectRatio`) nem era o que o gate do Epic 5 tinha sugerido.
- **Contrato fire-and-forget bem desenhado desde o início.** `trackLinkClick` valida UUID inline, valida `is_active`, nunca lança, retorna `ActionResult` tipado. Esse contrato sobreviveu intacto a **dois refactors profundos** no Epic 6 (INSERT → RPC, depois rate limiting em duas camadas) sem que `TrackedLink.tsx` fosse tocado. Contrato bem definido é o que permite endurecer a implementação depois sem quebrar a superfície.
- **Privacidade desenhada, não remendada.** Sem IP raw; UA truncado ≤120 chars **no app E via CHECK no banco**. A redundância app+banco valeu: no Epic 6 a RPC passou a truncar dentro da função e o CHECK continuou sendo a rede de segurança contra chamador direto.
- **QA independente e adversarial pegou um bug real de métrica.** O `onAuxClick` contava qualquer botão não-primário, incluindo o **botão direito** (menu de contexto, que não navega) — inflava a métrica com clique fantasma. Corrigido na hora (commit `9dd7935`, só `button===1`).
- **Reconciliações pré-execução continuam pagando.** As 5 decisões de escopo do plano (gráfico, authz app-layer, privacidade, agregação, dependência do Epic 4) foram tomadas **antes** da Wave 1. Nenhum retrabalho de escopo durante a implementação, pelo terceiro epic seguido.
- **A lição do Epic 4 entrou no DoD e funcionou.** "`pnpm dev` sobe sem erro" virou gate executado, e a causa-raiz do bug do Epic 4 foi fechada de vez com `@source not "../docs"` no Tailwind — não só o sintoma.

## O que pode melhorar

- **O smoke test manual nunca foi executado. Ele segue pendente até hoje.** Esta é a lição mais importante do Epic 5. A Story 5.6 entregou `docs/smoke-test.md` com 7 passos (incluindo o e2e do reset por e-mail, débito herdado da retro do Epic 3) e o README ganhou "O MVP está pronto quando…". O gate deu PASS. Mas o OWN-1 nunca rodou: o epic entregou o **roteiro**, não a **execução**. Escrever o documento contou como concluir a story; o item humano ficou marcado como "não bloqueia o código" e, por isso, não bloqueou nada — inclusive não bloqueou a declaração de MVP, que também nunca aconteceu. **Lição:** um AC cujo cumprimento depende de um humano precisa de dono, prazo e um estado explícito de "pendente" que apareça no epic seguinte — não de uma nota de rodapé.
- **O roteiro nem era capaz de provar o que o Epic 6 mudaria.** O final gate do Epic 6 constatou que os 7 passos do smoke **passariam idênticos com toda a segurança desligada** — não distinguem authz app-layer de RLS, não exercitam rate limiting, não olham o console para violação de CSP. Não é culpa do Epic 5 (a segurança ainda não existia), mas revela que o roteiro foi escrito como checklist de *features*, não de *garantias*. **Lição:** smoke test é artefato vivo; todo epic que muda comportamento observável deve atualizá-lo, e o final gate deve perguntar "este roteiro consegue reprovar algo?".
- **A retro do Epic 5 não foi escrita no fechamento do Epic 5.** Ela só saiu como pré-requisito (OWN-4) do Epic 6, semanas depois. O custo é real: as lições que teriam alimentado o planejamento do Epic 6 chegaram depois dele. **Lição:** retro faz parte do fechamento do epic, não do backlog.
- **O débito de segurança foi corretamente identificado — e estava vivo em produção.** O gate marcou como MEDIUM "a anon key permite INSERT direto em `link_clicks` via PostgREST", deferido conscientemente ao Epic 6. Correto como decisão. Mas o preflight do Epic 6 confirmou que o furo esteve **ativo em produção** o tempo todo, e ainda descobriu um segundo que ninguém tinha visto: a view `link_click_daily`, criada nesta Story 5.4 sem `security_invoker`, expunha a agregação de cliques de **todos os perfis** à anon key. Deferir um risco conhecido é legítimo; o problema é que **não inventariamos o que o deferimento realmente cobria**.
- **Benchmark medido, mas com dado sintético.** Os <100ms (na prática <10ms DB-side) vieram de 10k cliques semeados. Produção tinha — e ainda tem — zero cliques. O número é bom, só não é evidência sobre a realidade.

## Métricas

- **Stories:** 6 (5.1–5.6) — todas Ready for Review → **QA gate PASS_WITH_CONCERNS**
- **Waves:** 4 (Fundação de Dados · Tracking & Agregação · Superfícies · Fechamento do MVP)
- **Testes:** 192 verdes +1 skipped (35 arquivos) — era 153 no baseline do Epic 4 (+39)
- **Commits:** 9 no branch `feature/epic-5-analytics` (inclui o fix do clique fantasma)
- **Diff:** 37 arquivos, +2860 / −40
- **Migrations:** 2 (`link_clicks`, `link_click_daily`) — aplicadas em prod pelo CD
- **Dependências novas:** zero
- **PR:** #11 (mergeado)

## Entregáveis do Epic 5

- `supabase/migrations/20260702011034_link_clicks.sql` — tabela append-only, índice `(link_id, clicked_at desc)`, CHECK de UA ≤120
- `supabase/migrations/20260702120000_link_click_daily.sql` — view de agregação diária
- `lib/actions/track-click.ts` — `trackLinkClick` fire-and-forget, nunca lança
- `components/public/TrackedLink.tsx` — `<a href>` preservado (Ctrl/middle/teclado)
- `lib/analytics/clicks.ts` + `lib/analytics/chart.ts` — agregação e geometria do gráfico (puros)
- `app/dashboard/analytics/` — tabela + gráfico SVG + toggle 7/30/90d + estado vazio + skeleton
- `docs/smoke-test.md`, README "O MVP está pronto quando…", `docs/architecture/ER.md` com `link_clicks`
- `docs/qa/gates/epic-5-qa-gate.yml`

## Decisões que valem para os próximos epics

- **Gráficos permanecem zero-dep (SVG inline + tokens)** — mas com verificação de responsividade explícita no DoD.
- **Contrato antes da implementação** (fire-and-forget, `ActionResult`, nunca lança): foi o que permitiu ao Epic 6 trocar o motor sem tocar na UI.
- **Defesa redundante app + banco** (truncamento de UA) provou-se certa quando surgiu um caminho de escrita novo.
- **Deferir risco é legítimo; deferir sem inventariar não é.** Todo deferimento de segurança deve listar as superfícies afetadas, não só a tabela citada.
- **Itens humanos precisam de dono e de bloqueio real**, senão viram permanentes.

## Estado ao final do Epic 5: o MVP foi declarado pronto?

**Não.** O produto ficou **funcionalmente completo** — os 6 pilares integrados, 4 gates verdes, `pnpm dev` sobe, CI verde, migrations em produção. Mas a *declaração* de MVP dependia de três itens humanos e **nenhum deles aconteceu**:

- OWN-1 — smoke test manual ponta a ponta: **pendente até hoje**
- OWN-2 — 3 reproduções externas do setup local: pendente
- OWN-3 — tag `v0.1.0` + PRD → 1.0: pendente (e agora urgente, porque o merge do Epic 6 sem a tag perde o ponto de corte do MVP para sempre)

A resposta honesta é que o Epic 5 entregou tudo que era código e nada que era cerimônia — e a cerimônia era justamente o que transformaria "funciona" em "declarado pronto".
