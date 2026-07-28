# Retrospectiva — Epic 6: Segurança em Camadas & Hardening

**Data:** 2026-07-19
**Agentes:** @pm (Morgan), @architect (Aria), @dev (Dex), @qa (Quinn), @data-engineer (Dara), @ux-design-expert (Uma), @sm (River)
**Duração do epic:** sessão única, 4 waves em modo YOLO (branch única `feature/epic-6-security`)

Promoção do produto de "funcional" (MVP, Epics 1–5) para "defensável": RLS em `profiles`/`links`/`link_clicks` como defense-in-depth sobre a authz app-layer, rate limiting nativo nos 4 endpoints do NFR18, middleware edge (auth guard + refresh + CSP formal) e os débitos de a11y do Epic 4.

Este é o epic com mais achados de todo o projeto — e, por isso mesmo, o mais instrutivo. **Quase todo defeito grave encontrado aqui foi encontrado por um gate, não por um teste.**

---

## O padrão "MVP primeiro, hardening depois" se pagou didaticamente?

**Sim, e de forma mais interessante do que o planejado — mas cobrou um preço que não estava no plano.**

O ganho didático é real e específico: porque a authz app-layer já existia e funcionava, cada policy de RLS pôde ser ensinada como *segunda* camada, com um contraste observável ("antes a `.eq()` segurava; agora a policy segura mesmo sem a `.eq()`"). Os testes tornaram isso literal — `link-clicks-rls.test.ts:177` lê **sem filtro app-layer nenhum**: se a policy falhar, o teste quebra. Isso é um teste de RLS de verdade, e ele só é escrevível porque houve um "antes".

O preço: **o MVP ficou meses em produção com dois furos abertos.** O preflight do Epic 6 mediu, não supôs — em produção, no momento do gate, `anon` tinha `INSERT/SELECT/UPDATE/DELETE/TRUNCATE` em `link_clicks` **e** na view `link_click_daily`. O deferimento do Epic 5 era consciente quanto ao INSERT; quanto à view, ninguém sabia. O que salvou foi que produção tinha 1 perfil e 0 cliques: o dano real foi zero por falta de tráfego, não por controle.

**Lição:** "MVP primeiro, hardening depois" é didaticamente excelente e operacionalmente aceitável **enquanto não há usuários**. A janela entre os dois epics é dívida com juros, e o juro é proporcional ao tráfego. Se houvesse volume, esta retro teria outro tom.

---

## Alguma policy de RLS quebrou query em produção?

**Não. E a decisão #5 + o PRE-2 são o motivo — com um achado que ninguém tinha planejado.**

As três defesas funcionaram exatamente como desenhadas:

1. **Migration atômica (decisão #5a)** — policies criadas **antes** do `enable row level security`, no mesmo arquivo. Nunca houve janela de lockout, nas 3 migrations de RLS.
2. **App-layer preservada (decisão #5b)** — o gate da Wave 1 verificou **no diff**, não no relatório: zero arquivos de `lib/`, `app/` ou `components/` tocados; 16 filtros de ownership no lugar. A Wave 1 foi puramente aditiva.
3. **Inventário PRE-2** — mapear todas as queries por tabela antes de escrever a primeira policy. Foi o que evitou os dois erros clássicos: `links_select_own` **não** filtra `is_active` (senão o dashboard perderia os links inativos do dono), e `profiles_select_public USING (true)` foi mantido porque o signup anônimo consulta `profiles` para checar username duplicado — restringir teria quebrado o **cadastro em silêncio**.

**O achado que justifica o inventário sozinho:** o PRE-2 encontrou um item que **não estava no plano do epic** — a view `link_click_daily`, criada no Epic 5 sem `security_invoker`. Views sem `security_invoker` executam com os privilégios do *owner*, e o owner é `postgres`, que tem `BYPASSRLS`. Enquanto `link_clicks` não tinha RLS isso era inofensivo. No instante em que a Story 6.3 habilitasse RLS, a view viraria **bypass total**: qualquer um com a anon key leria a agregação de cliques de todos os perfis. E o gate confirmou que o vazamento já estava **ativo em produção** naquele momento.

**Lição acionável — a mais transferível deste epic:** *ao mudar authz, inventarie objetos, não tabelas.* Views, funções `SECURITY DEFINER`, grants default e triggers são caminhos de acesso tanto quanto tabelas, e o modelo mental "liguei RLS na tabela, está protegida" é falso. O inventário também pegou o `handle_new_user` (trigger de signup) — cujo owner foi verificado **em produção**, não só em dev, porque se não fosse `postgres`/`BYPASSRLS` o merge quebraria o cadastro inteiro.

---

## A escolha de rate limiting (nativa vs serviço) foi acertada?

**A tecnologia, sim. O desenho inicial da política, não — e só um gate adversarial pegou isso.**

A escolha Supabase-native (tabela de contadores + função com janela deslizante + `pg_advisory_xact_lock`) se pagou: zero dependência nova (nem Upstash, nem Vercel KV), consistente com o princípio do projeto, e **provadamente correta sob concorrência** — o gate disparou 40 chamadas simultâneas com limite 20 e o banco gravou exatamente 20 hits. Também não tem o defeito clássico do contador fixo (burst de 2x na virada de janela), porque a janela é soma de sub-buckets; o erro residual é de +16% no tracking, medido e aceito.

O problema não estava na tecnologia — estava em **onde** o limite seria aplicado. Dois erros de desenho em sequência, ambos encontrados por gates:

**Erro 1 — o gate da Wave 2 provou que o plano não fechava o vetor.** A Story 6.4 planejava aplicar `checkRateLimit` dentro de `trackLinkClick`, uma Server Action do Next.js. Mas `record_link_click` é `grant execute to anon` e está exposta em `POST /rest/v1/rpc/record_link_click`: um atacante **não precisa passar pelo Next.js**. O gate não argumentou — provou, com 20 chamadas curl diretas que gravaram 20 cliques forjados num link real (e depois limpou o estado). Agravante que o plano também não previa: a chave do bucket era `hash(ip + linkId)` e a RPC **não enxerga o IP**, então nem dava para "só mover a chamada para dentro". Resultado: Emenda 1 do ADR-001, teto de 60/min por `link_id` **dentro da RPC** — a única camada que alcança o curl direto. O gate da Wave 3 depois reproduziu o ataque com 75 chamadas: barrado na 61ª.

**Erro 2 — a correção introduziu um HIGH que o próprio desenho do ADR criou.** Para o helper TS funcionar com a anon key, o ADR expunha `check_rate_limit` como **primitiva genérica** a `anon`, com `p_bucket`, `p_subject`, `p_limit` e `p_window_seconds` inteiramente controlados pelo chamador. Ou seja: um mecanismo defensivo virou **primitiva de escrita remota**. O gate da Wave 3 provou três abusos: (a) 60 chamadas anônimas esgotavam o balde `track_link` de um link de terceiro **sem gravar um único clique**, silenciando a analytics daquele link — mais barato e mais discreto que a click inflation que a story estava fechando; (b) com o pepper vazio, 10 requisições negavam login a um IP arbitrário por 15 minutos; (c) buckets arbitrários eram aceitos, permitindo crescimento irrestrito da tabela.

A frase do gate resume melhor do que qualquer paráfrase: **a story "limitava a inflação de cliques e abria a supressão de cliques"** — do ponto de vista de integridade de analytics, aproximadamente uma troca, não um ganho líquido.

A correção (migration de hardening): revogar a primitiva de `anon` e expor `check_app_rate_limit`, um wrapper com **allowlist de bucket** e **limites derivados do bucket, não recebidos do chamador** — "o chamador escolhe QUEM é, não QUANTO pode". O gate da Wave 4 reproduziu os três abusos e todos foram barrados, e validou empiricamente o ponto frágil do desenho (que `record_link_click`, sendo `SECURITY DEFINER`, continua alcançando a primitiva revogada internamente) com 65 chamadas reais — porque, se essa aposta estivesse errada, o teto teria sido **silenciosamente desligado** sem nenhum sinal de erro.

**Lição acionável:** *expor mecanismo é diferente de expor política.* Sempre que uma superfície pública receber os parâmetros do próprio controle, pergunte "o que acontece se o atacante escolher esses valores?". A regra prática que emergiu daqui — o chamador informa a identidade, o servidor decide o limite — vale para qualquer API futura.

---

## CSP deu retrabalho?

**Retrabalho de código, quase nenhum. Retrabalho de justificativa, sim — e o gate tratou isso como defeito de produto, corretamente.**

A implementação foi direta e a decisão de escopo foi julgada "a única defensável": headers em `next.config.ts` (`/:path*`), não no middleware. O gate verificou a *consequência* da alternativa em vez de aceitar o argumento — se a CSP morasse no middleware, cobriria só `/dashboard/*` e deixaria `/[username]` descoberta, justamente a rota anônima que renderiza `avatar_url` arbitrário e URLs fornecidas pelo usuário. Os 4 headers saíram em 8/8 rotas, em modo enforce, inclusive nos assets.

O retrabalho foi na **documentação**, e a razão importa: a justificativa registrada para `script-src 'unsafe-inline'` estava factualmente errada em dois pontos — (a) que o App Router "exigiria de qualquer forma" (falso: nonce via middleware é padrão de primeira classe do Next) e (b) que o nonce quebraria o ISR da página pública (defendia um cache **que não existe** — a rota responde `no-store`). O gate não pediu mudança de código; pediu que a decisão fosse registrada como o que é: **escolha de simplicidade com um custo declarado** (`script-src` com `unsafe-inline` não mitiga XSS; o ganho está em `object-src 'none'`, `base-uri`, `form-action` e `frame-ancestors`). Corrigido no commit `d52d9a6`.

**Lição:** num projeto didático, uma justificativa tecnicamente errada é um defeito entregue ao leitor, mesmo quando o código está certo. "Escolhemos o simples e o preço é X" ensina; "era impossível" ensina errado.

---

## Outros erros que merecem registro

### O trade-off "a11y vs identidade visual" era falso

A Story 6.6 assumiu como risco (R1) que escurecer o accent até 4.5:1 custaria vibração da marca, e o @dev registrou honestamente que o resultado ficou "mais terroso". O gate de design mostrou que **o trade-off era artefato do método**: escurecer por escala RGB uniforme preserva o matiz HSL mas **dessatura por construção**, porque encolhe proporcionalmente a distância entre canais. Calculando em OKLCH (reduzir L mantendo C e H), `#b35536` **domina** a escolha original em todos os eixos ao mesmo tempo: mais contraste sobre branco (4.92 vs 4.56), mais contraste sobre o canvas (3.39 vs 3.15) e croma a **0.2%** do original. Não havia trade-off a pagar.

Bônus do mesmo gate: a busca do @dev foi *unidimensional* (uma única escala a partir do original), e por isso a melhor opção nunca entrou na comparação. **Lição:** meça identidade de cor em espaço perceptual (OKLCH), não em HSL; e quando um trade-off parecer inevitável, verifique se ele não é consequência da ferramenta que você escolheu para explorar o espaço.

O mesmo gate também encontrou a **fonte de reincidência** do bug: 7 arquivos de referência ainda descreviam o canvas do tema accent como `#FAF7F2` em vez de `#EDD3A9` — incluindo o README que é o corpo da skill `biolink-design`, que se contradizia internamente. Deixar isso de pé faria o próximo agente reintroduzir o bug. Corrigido.

### O fail-fast do pepper foi implementado no lugar errado

`lib/rate-limit.ts` afirmava, em comentário, que sem `RATE_LIMIT_PEPPER` em produção "o app NÃO SOBE" e "quebra ruidosamente no boot". O gate da Wave 4 **testou** e a afirmação era falsa: `pnpm build` exit 0, o servidor sobe, `/`, `/login`, `/signup`, `/[username]` e **`/health` respondem 200 sem um único erro no log**. O throw só dispara na primeira invocação real de uma Server Action — porque o Next carrega esses módulos sob demanda.

O modo de falha resultante é o pior possível: um deploy mal provisionado fica com **todos os sinais verdes** — build, deploy, homepage, página pública, health check — enquanto login, signup, reset e tracking devolvem 500. Monitoração de disponibilidade de página não vê nada. Quem descobre é o usuário tentando entrar.

O julgamento do gate é o registro mais útil: **o princípio está certo, a implementação está no pior lugar possível** — tarde demais para impedir o deploy ruim, cedo demais para ser inofensiva. A correção foi mover a validação para o **build** (`assertProductionEnv` em `next.config.ts` + preflight na CI), tornando o artefato ruim impossível de existir e o throw um backstop redundante. Commit `9f20cb2`.

**Lição:** *fail-fast só é fail-fast se falhar onde o sinal é observado.* Um throw em topo de módulo não é boot em runtime serverless. E: quando um comentário descreve comportamento, teste o comentário.

### Nenhum agente conseguiu validar nada visualmente — em nenhuma tentativa

Isto é uma **limitação estrutural do processo**, não um descuido, e vale registrar com todas as letras. O @dev (Story 6.6), o @ux-design-expert (design gate), o @qa (Wave 4) e o @qa (final gate) tentaram, cada um por sua vez, obter um browser — `list_connected_browsers` retornou vazio em **todas** as tentativas. Consequências concretas:

- A **AC7 da Story 6.6** (validação visual dos 3 temas) nunca foi cumprida e não pode ser assinada por procuração.
- A **AC7 da Story 6.5** (console limpo de violações de CSP) permanece não verificada por observação direta.
- A jornada pela UI autenticada (arrastar link, trocar período do gráfico, logout pelo botão) ficou aberta nas Waves 2, 3 e 4 — **aceita três vezes seguidas**.

O que compensou parcialmente: o gate da Wave 4 foi muito além do que o @dev conseguiu — criou usuário de probe, logou pelo caminho real do produto, montou o cookie no formato do `@supabase/ssr`, renderizou o dashboard autenticado nos 3 temas e **provou o refresh proativo de token** expirando o access_token e observando o `Set-Cookie` novo. E enumerou toda a superfície de recursos do HTML realmente servido (5 rotas × 3 temas: zero script/stylesheet/img externo), o que reduz o gap de CSP a "comportamento que só existe em runtime de browser".

**O comportamento exemplar a preservar:** todos os agentes **declararam explicitamente o que não viram** em vez de assinar embaixo. É isso que torna um gate confiável. **A ação estrutural:** ou o pipeline ganha browser confiável, ou toda AC de natureza visual precisa nascer com dono humano e uma janela de execução — não como AC de agente que "vai ficando".

### O gate final achou uma armadilha de CI/CD que teria mergeado código novo com schema velho

O job `quality` do `ci.yml` passou a exigir `secrets.RATE_LIMIT_PEPPER`, mas **não declara `environment:`** (só `migrate-production` declara `environment: production`). Um secret criado apenas no environment `production` fica **invisível** para o `quality` → a CI falha → e como `migrate-production` tem `needs: quality`, **as migrations não são aplicadas**. Resultado: main mergeada, código novo no ar, schema antigo no banco — o pior dos dois mundos, e com aparência de erro de CI trivial.

O mesmo gate achou uma segunda dependência silenciosa criada pelo epic: a CSP é montada em `next.config.ts`, avaliado em **tempo de build**, lendo `NEXT_PUBLIC_SUPABASE_URL`. Se a var existir só em runtime, o header sai com `connect-src 'self'` e **toda chamada do browser ao Supabase é bloqueada** — o login quebra no console, sem um único erro de servidor. Antes do Epic 6 essa var só era necessária em runtime.

**Lição:** mudanças de segurança criam **dependências de provisionamento e de build** que não aparecem em nenhum teste. Um final gate que só olha código não as vê; olhar CI, ambientes e escopo de secret é parte do gate.

---

## O que o processo AIOX claramente acertou

- **Gates adversariais com probes próprias, não leitura de relatório.** Todo gate deste epic reproduziu os números do zero, com curl e a anon key crua contra o PostgREST, e leu o catálogo pela Management API. Três achados graves (view sem `security_invoker`, rate limiting que não fechava o vetor, `check_rate_limit` como primitiva de escrita) **nenhum teste teria pego** — só ataque deliberado pega.
- **Gates auditando contra mascaramento.** O gate da Wave 2 procurou especificamente a fraude mais provável (trocar client anon por `createAdminClient()`, que bypassa RLS e tornaria os testes tautológicos). Não aconteceu — e o gate da Wave 3 fez o mesmo com as duas expectativas alteradas, concluindo que ficaram **mais estritas**. Auditar a *correção do teste* é tão importante quanto auditar o código.
- **Roteamento de decisão em vez de decisão pelo gate.** Nos dois achados de desenho (Wave 2 e Wave 3), o gate explicitamente **não decidiu** — enumerou opções e roteou para @architect/@pm, com a frase certa: "precisa ser decidido conscientemente, não por omissão". Manteve a autoridade onde ela pertence e evitou que o silêncio virasse decisão.
- **Concerns com carry-forward rastreado entre waves.** Cada gate lista `inherited_concerns` com status (CLOSED / STILL_OPEN / RESOLVED_BY_...). Foi assim que o achado da view atravessou da Wave 1 para a Wave 2 sem se perder, e é o que fez o final gate conseguir consolidar 10 débitos técnicos numa lista única.
- **Preflight de produção dentro do gate.** Sondar o banco de **produção** antes do merge (owner de `handle_new_user`, grants existentes, volume real) transformou várias predições em observações. Foi o preflight que descobriu que os furos estavam vivos em prod.
- **Migrations atômicas + CD** — pelo quarto epic seguido, zero passo manual em produção.

## O que o processo AIOX deixou passar

- **Um AC nomeando um agente específico caiu no vão entre gates.** A AC11 da Story 6.3 exigia revisão de DDL pelo **@data-engineer**. As Waves 1 e 2 tiveram `gate_agent` diferentes (@data-engineer vs @qa) e o item nunca foi executado — atravessou as Waves 2, 3 e 4 como `STILL_OPEN`. Agravante: o gate da Wave 3 **encontrou um HIGH exatamente na DDL** que a revisão cobriria. **Lição:** AC que nomeia um agente diferente do `gate_agent` da wave precisa de um passo próprio, não de uma menção.
- **"Aceito" repetido três vezes vira permanente.** A jornada pela UI real foi aceita nas Waves 2, 3 e 4 com a mesma justificativa. Cada aceitação individual era razoável; o efeito acumulado é um débito que o epic inteiro nunca fechou. **Lição:** um concern aceito **N vezes seguidas** deveria escalar automaticamente, não repetir a justificativa.
- **O smoke test não acompanhou o epic.** O final gate constatou que o roteiro do Epic 5 "passaria idêntico com toda a segurança desligada" e especificou 6 atualizações (SMOKE-A..F). Isso deveria ter sido uma story da Wave 4, não um achado do final gate.
- **A retro do Epic 5 (OWN-4) foi listada como pré-requisito do Epic 6 e mesmo assim só saiu no fim.** Pré-requisito que não bloqueia não é pré-requisito.

---

## Métricas

- **Stories:** 6 (6.1–6.6)
- **Waves:** 4 (RLS Foundation · Tracking Hardening · Rate Limiting · Edge & Polimento)
- **Gates:** 6 — Wave 1 `APPROVED`, Waves 2/3/4 `CONCERNS`, design gate `CONCERNS`, **final gate `PASS_WITH_CONCERNS`**
- **Testes:** 333 verdes +1 skipped (43 arquivos) — era 192 no baseline do Epic 5 (**+141, crescimento de 73%**)
  - Progressão: 192 (E5) → 219 (W1) → 233 (W2) → 296 (W3) → 317 (W4) → 333 (final)
- **Commits:** 37, **100% conventional** com `[Story 6.x]` / `[EPIC-6]`
- **Diff:** 62 arquivos, +12970 / −231
- **Migrations:** 5 (`profiles_rls`, `links_rls`, `link_clicks_rls`, `rate_limit`, `rate_limit_hardening`)
- **Dependências novas:** **zero** (`node:crypto` + `next/headers`, ambos built-in)
- **Achados por severidade:** 1 HIGH (corrigido dentro do epic), 8 MEDIUM, ~20 LOW/info
- **Débitos abertos consolidados:** 5 human-dependent (HD-1..HD-5), 10 técnicos (TD-1..TD-10), 5 aceitos por design

## Entregáveis do Epic 6

- `supabase/migrations/20260719*` — 5 migrations: RLS em `profiles`/`links`/`link_clicks`, RPC `record_link_click`, `rate_limit_counters` + `check_rate_limit`, e o hardening (`check_app_rate_limit` com allowlist)
- `lib/rate-limit.ts` — `clientIp` efêmero, `subjectHash` com pepper, `TARGETS` do NFR18, fail-open
- `lib/actions/auth.ts` — throttle em `signUp`/`signIn`/`requestPasswordReset`, mensagem genérica única
- `lib/actions/track-click.ts` — tracking via RPC (elimina TOCTOU, 2 round-trips → 1)
- `middleware.ts` — auth guard edge + refresh proativo de token (matcher `/dashboard/:path*`)
- `next.config.ts` — CSP enforce + XFO + nosniff + Referrer-Policy + `assertProductionEnv`
- `app/globals.css` + `theme-selector.tsx` — accent `#b35536` (OKLCH), swatch `#EDD3A9`
- `components/dashboard/clicks-chart.tsx` — escala uniforme (fecha o débito de mobile do Epic 5)
- `app/auth/callback/route.ts` — open redirect por backslash fechado
- `docs/architecture/security-epic-6.md` (ADR-001 + Emenda 1), `docs/architecture/technical-debt.md` (DEBT-001), 6 gates em `docs/qa/gates/`

## Decisões que valem para os próximos epics

- **RLS: policies e `enable` sempre na mesma migration**, app-layer nunca removida (defense-in-depth real, verificado no diff).
- **Inventariar objetos antes de mudar authz** — views, funções `SECURITY DEFINER`, grants default e triggers, não só tabelas.
- **Superfície pública nunca recebe os parâmetros do próprio controle** — o chamador diz quem é, o servidor decide quanto pode.
- **Validação de env obrigatório mora no build**, não no topo de um módulo carregado sob demanda.
- **Cor se mede em OKLCH**, não em HSL.
- **Gate adversarial roda probes próprias e restaura o estado** — o padrão deste epic (ataque real + cleanup verificado por diff programático) deve continuar.
- **ADR numerado (`ADR-NNN`) é o formato do projeto**, inaugurado aqui.

---

## O produto pode ser declarado "publicável em produção aberta"?

**Ainda não — e o final gate está certo em não assinar.** A frase dele é a formulação exata:

> "O epic promoveu o produto de funcional para **defensável**; declará-lo publicável é uma afirmação sobre **produção**, e produção ainda não foi observada."

O que está provado: as 3 tabelas multi-tenant têm RLS efetiva; o INSERT anônimo em `link_clicks` retorna 42501; a click inflation é barrada na 61ª de 66 chamadas diretas; os 4 targets do NFR18 batem ao número, medidos ao vivo; o contraste do accent está em 4.92:1 e blindado na CI; 333 testes, typecheck, lint, build e `pnpm dev` verdes. Tudo isso **em development**.

O que falta, e é exatamente o que separa "defensável" de "publicável":

1. **6 precondições BLOCKING de provisionamento (PRE-M1..PRE-M6)** — `RATE_LIMIT_PEPPER` como secret de **repositório** no GitHub (a armadilha do `environment:`), na Vercel prod e preview, e `NEXT_PUBLIC_SUPABASE_URL` disponível em tempo de build.
2. **PRE-M7, verificação pós-deploy — não opcional.** A parte mais frágil do epic só existe como **predição** sobre produção: que o owner das funções `SECURITY DEFINER` tenha `BYPASSRLS` em prod. Se não tiver, o `exception when others` engole o erro, o rate limiting fica **silenciosamente desligado** e nenhum sinal fica vermelho. Um produto que se declara protegido sem estar é pior que um que se sabe desprotegido.
3. **Smoke test atualizado (SMOKE-A..F) e executado por um humano** — fecha HD-1 (AC7 visual), HD-2 e HD-3 numa sessão de ~10 minutos.
4. **Tag `v0.1.0` ANTES do merge (PRE-M9)** — o Epic 6 é pós-MVP; mergear antes de taggear perde o ponto de corte do MVP para sempre, e isso é irreversível sem reescrever histórico.

## Próximos passos

- **@devops:** PRE-M1..PRE-M6 (BLOCKING) → tag `v0.1.0` → push + PR → merge → **PRE-M7 na mesma sessão**.
- **@sm:** atualizar `docs/smoke-test.md` com SMOKE-A..F antes do OWN-1.
- **Owner:** smoke atualizado (fecha HD-1, HD-2, HD-3 e o débito de console das Waves 2-4 de uma vez).
- **@architect:** DEBT-001 (o ISR de `/[username]` que nunca existiu) e reavaliação da CSP com nonce (TD-2 — o custo caiu junto com TD-1).
- **@data-engineer:** revisão formal de DDL, pendente desde a Wave 2 e agora incluindo `check_app_rate_limit`. **Não tratar como formalidade** — a DDL anterior rendeu um HIGH.
- **Story de manutenção:** `middleware.ts` → `proxy.ts` (Next 16.2.6 depreciou o convention; quando ele parar de ser reconhecido, o guard edge some **sem quebrar build, typecheck nem os 9 testes** — e só o guard de layout seguraria, o que valida o AC3 de um jeito que a story não previu).
