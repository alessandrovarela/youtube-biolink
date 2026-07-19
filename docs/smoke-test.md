# Smoke Test Manual — MVP + Epic 6 (ponta a ponta)

> Roteiro de validação **manual** do fluxo completo: signup → perfil/tema → links → página pública → clique → analytics, mais o **reset de senha por e-mail** — e, desde o **Epic 6**, as camadas de segurança (**RLS**, **auth guard**, **CSP** e **rate limiting**).
>
> ⚠️ **Por que o roteiro cresceu:** o gate final do Epic 6 constatou que os 7 passos originais **passariam idênticos com toda a segurança desligada** — um smoke que não distingue os dois estados não prova nada sobre o epic. Os passos **2b, 8 e 9** e as notas dos passos **4 e 5** existem para que o roteiro exercite o que o Epic 6 entregou.
> **E2E automatizado está fora de escopo** (PRD § "Sem E2E automatizado no MVP"). Este roteiro é a validação ponta a ponta oficial após cada release candidate.
> Consolida e substitui o smoke por-epic (ver `docs/qa/epic-3-manual-test.md`).
>
> **Quem executa:** o **owner** (requer interação humana real com e-mail e navegador). A Story 5.6 **produz** este roteiro; **não** o executa.

## Como subir o app

```bash
pnpm dev        # http://localhost:3000 (Next.js 16 + Supabase development na nuvem)
```

Dados persistem no **Supabase `development`** (tabelas `profiles`, `links`, `link_clicks` já aplicadas lá).

## Pré-requisitos gerais

- App rodando em `http://localhost:3000` (ou usar a produção `https://youtube-biolink.vercel.app`).
- Uma **mailbox de teste** acessível (o e-mail é enviado pelo Supabase built-in; ~2-4 e-mails/h — respeite o rate limit do SMTP dev).
- Um **segundo navegador** (ou janela anônima) para simular o visitante da página pública.
- **DevTools do navegador** — os passos 8 e 9 pedem a aba **Console** aberta.
- Recomendado: começar com um username novo para não colidir com dados anteriores.

### `RATE_LIMIT_PEPPER` no `.env.local` *(SMOKE-A — Epic 6)*

```bash
# no .env.local, valor DIFERENTE por ambiente
RATE_LIMIT_PEPPER=$(openssl rand -hex 32)
```

Este env dá o "pepper" do hash que identifica o chamador no rate limiting (o IP **nunca** é gravado — só o digest de 64 hex sai do processo).

**O que acontece se você não definir** — importa saber, para não confundir aviso com defeito:

| Ambiente | Comportamento REAL |
|---|---|
| **development** (`pnpm dev`) | O app **sobe e funciona normalmente**, usando um fallback fixo e documentado, e imprime **um aviso único** no log (`[rate-limit] RATE_LIMIT_PEPPER não definido…`). Esse aviso é **esperado**, não é bug. Rate limiting continua exercitável (passo 9). |
| **production** (`next build` / `next start`) | O **build FALHA** — `assertProductionEnv()` em `next.config.ts` roda antes de qualquer compilação. O artefato ruim nunca chega a existir. |

> Se você quer o roteiro fiel à produção, defina o pepper e o aviso some. Se preferir rodar sem ele, tudo bem — só não conte o aviso como falha do smoke.

---

## Roteiro

### 1. Criar conta + confirmar e-mail (FR1, FR2, FR7)

- **Pré-condição:** deslogado; username de teste disponível; mailbox acessível.
- **Ação:** acessar `/signup`, preencher e-mail, senha e **username único** (evite reservados: `admin`, `api`, `dashboard`, `login`, `signup`…). Enviar. Ir à mailbox e clicar no link de confirmação.
- **Resultado esperado:** após o submit, redireciona para `/signup/check-email` com instrução de checar o e-mail. O link do e-mail confirma a conta (callback `/auth/confirm...`) e habilita o login. Username reservado ou duplicado → erro inline (não cria).
- [ ] Passo 1 OK

### 2. Logar, editar perfil e escolher tema `accent` (FR3, FR8, FR17, FR18)

- **Pré-condição:** conta confirmada (passo 1).
- **Ação:** acessar `/login`, logar. No `/dashboard`, editar **display_name** e **bio** (≤160 chars) e, opcionalmente, **avatar_url** (http/https válida). Salvar. No seletor de tema, escolher **`accent`**.
- **Resultado esperado:** login persiste a sessão (cookies server-side). Perfil salvo com feedback imediato. O tema `accent` aplica-se ao dashboard e persiste no perfil.
- [ ] Passo 2 OK

#### 2b. Checklist visual do tema `accent` *(SMOKE-E — fecha a AC7 da Story 6.6)*

> **Por que este bloco existe:** o Epic 6 mudou o `accent` de `#D97757` para **`#B35536`** (contraste 4.92:1, era 3.4:1) e o canvas do swatch de `#FAF7F2` para **`#EDD3A9`**. Toda a análise de contraste foi **analítica** — nenhum agente viu os temas renderizados. Contraste calculado não é a única dimensão visual, então **só olhos humanos fecham a AC7**. Faça esta passada com o tema `accent` ativo.

- [ ] **(i) Rótulo do Button primary legível.** Em `/dashboard/links`, olhe o botão primário ("Adicionar link" / "Salvar"): o texto **branco sobre o âmbar-terroso `#B35536`** deve ser confortável de ler, sem "vibrar" nem sumir. Se parecer lavado, é regressão.
- [ ] **(ii) Focus ring visível sobre o canvas âmbar.** Pressione **Tab** repetidamente pelo dashboard: cada elemento focado precisa ter um **anel de foco claramente perceptível contra o fundo `#EDD3A9`**. Este é o caso mais arriscado — anel âmbar sobre fundo âmbar. Nenhum elemento pode "sumir" ao receber foco.
- [ ] **(iii) Swatch = página real.** Abra o seletor de temas e compare o **quadradinho de preview do `accent`** com a página que ele aplica: as cores devem bater **visualmente**. Um preview que promete uma cor e entrega outra era exatamente o bug corrigido.
- [ ] **(iv) Gráfico de analytics sem distorção.** Em `/dashboard/analytics`, veja o gráfico de cliques por dia **em desktop** e depois **estreite a janela para largura de celular (~375px)** ou use o device toolbar do DevTools. O SVG deve **escalar proporcionalmente** (3:1), sem esticar/achatar os elementos e sem faixas pretas em cima/embaixo. *O Epic 6 mudou a escala deste gráfico (`preserveAspectRatio` removido, altura automática) — verificar nas duas larguras não é opcional.*
- [ ] Passo 2b OK — **AC7 da Story 6.6 assinada pelo owner**

### 3. Criar 3 links, reordenar (drag e teclado), desativar um (FR9, FR10, FR11, FR12, FR13)

- **Pré-condição:** logado (passo 2).
- **Ação:** em `/dashboard/links`, criar **3 links** (título + URL). Testar uma URL inválida (`javascript:alert(1)` ou `ftp://x`) → deve dar erro inline. Reordenar:
  1. **Drag-and-drop** pelo handle `⠿`.
  2. **Teclado** — botões **↑/↓** (acessível), verificando foco correto após mover.
  Depois, **desativar** (toggle Inativo) um dos links.
- **Resultado esperado:** os 3 links são criados; URL com scheme proibido é rejeitada. As duas formas de reordenar persistem a nova ordem. O link desativado permanece na lista do dashboard mas **não** aparecerá na página pública.
- [ ] Passo 3 OK

### 4. Acessar a página pública em outro browser anônimo (FR14, FR16, FR18)

- **Pré-condição:** passos 2 e 3 concluídos; segundo navegador/janela anônima aberto.
- **Ação:** no navegador anônimo (sem sessão), acessar `/{seu_username}`.
- **Resultado esperado:** renderiza avatar (ou fallback de iniciais) + display_name + bio, com o tema **`accent`** aplicado. Mostra **apenas os 2 links ativos** na ordem definida no dashboard; o link desativado **não** aparece. `<title>` = `{display_name} (@{username})`. (Username inexistente → 404 custom em pt-BR.)
- [ ] Passo 4 OK

> **O que mudou aqui no Epic 6** *(SMOKE-B)* — este passo passou a provar **duas coisas**, não uma.
>
> Até o Epic 5, "o link desativado não aparece" era uma asserção sobre a **app-layer**: a query em `lib/queries/public-page.ts` filtra `.eq('is_active', true)`. Quem tivesse a anon key e falasse direto com a API do Supabase (sem passar pelo Next.js) **lia os links inativos assim mesmo**.
>
> Agora existem **duas barreiras independentes**, e o passo exercita as duas de uma vez:
> 1. **App-layer** — o filtro na query continua exatamente onde estava (o Epic 6 não removeu **nenhuma** linha de autorização).
> 2. **RLS no banco** — a policy de `links` só entrega linhas com `is_active = true` para a role anônima. Mesmo furando o Next.js, a resposta vem **vazia**.
>
> **Este é o valor didático central do epic:** segurança em camadas significa que remover uma delas por engano não abre o produto. Se este passo passar, as duas estão de pé — e se alguém amanhã apagar o `.eq('is_active', true)`, o banco ainda segura.



### 5. Clicar em 2 dos links (verificar nova aba) (FR15, FR19)

- **Pré-condição:** página pública aberta no navegador anônimo (passo 4).
- **Ação:** clicar em **2** dos links ativos.
- **Resultado esperado:** cada link **abre em nova aba** (`target="_blank" rel="noopener noreferrer"`). Cada clique registra um evento (`link_id`, `clicked_at` server-side, user-agent truncado) via Server Action — sem endpoint público cru exposto.
- [ ] Passo 5 OK

> **O que mudou aqui no Epic 6** *(SMOKE-F)* — nada que você observe neste passo, **e isso é intencional**. Duas mudanças rodam por baixo:
>
> - **A gravação agora passa por uma RPC** (`record_link_click`, `SECURITY DEFINER`) em vez de um `INSERT` direto. Motivo: a tabela `link_clicks` ganhou RLS **sem** policy de INSERT para anônimos — um `POST` direto na API do Supabase agora recebe `42501 permission denied`. Era o débito MEDIUM aberto pelo Epic 5 (qualquer pessoa com a anon key podia inflar os contadores). A RPC é a única porta, com **uma** operação e auditável.
> - **Existe um teto de 60 cliques/minuto por link**, aplicado **dentro** da RPC — ou seja, ele alcança até quem chama a API direto, sem passar pelo Next.js.
>
> ⚠️ **Nota para quem for testar carga no futuro:** um smoke normal (2 cliques) **nunca** encosta nesse teto. Se um dia um teste de carga — ou um link genuinamente viral acima de ~1 clique/segundo — mostrar o analytics **subcontando**, isso é o teto agindo como projetado, **não um bug**. O excedente é descartado em silêncio de propósito: o tracking é fire-and-forget e jamais deve quebrar a navegação do visitante.



### 6. Voltar ao dashboard → analytics refletindo os 2 cliques (FR20)

- **Pré-condição:** os 2 cliques do passo 5 realizados.
- **Ação:** no navegador logado, acessar `/dashboard/analytics`.
- **Resultado esperado:** a tabela mostra os cliques por link (total, 7 dias, 30 dias) refletindo os **2 cliques** feitos; o **gráfico** de cliques por dia mostra o incremento do dia. Trocar o período (`?days=7/30/90`) mantém a coerência.
- [ ] Passo 6 OK

### 7. Reset de senha por e-mail — e2e (FR4) — *débito da retro do Epic 3*

> Este é o fluxo que só o **teste manual do owner** exercita ponta a ponta (clique real no link do e-mail). Ficou como **débito** na retro do Epic 3 (validação e2e bloqueada por rate limit do SMTP dev). Executar aqui.

- **Pré-condição:** existe uma conta confirmada; deslogado; mailbox acessível; respeitar o rate limit do SMTP dev (reset ~3/h/IP como alvo de referência).
- **Ação:** acessar `/reset-password`, informar o e-mail da conta e solicitar o reset. Abrir a mailbox e **clicar no link de recuperação** → cai em `/reset-password/confirm`. Definir uma **nova senha** e confirmar. Em seguida, logar em `/login` com a nova senha.
- **Resultado esperado:** o e-mail de recuperação chega; o link leva à tela de nova senha; a nova senha é aceita e o login subsequente funciona (a senha antiga deixa de valer).
- [ ] Passo 7 OK

### 8. Auth guard + console limpo de CSP (NFR4, Story 6.2/6.5) *(SMOKE-C — novo no Epic 6)*

> **Por que este passo existe:** três gates seguidos (Waves 2, 3 e 4) fecharam com o mesmo débito em aberto — *"ninguém navegou pela UI logada olhando o console"*. Este passo fecha esse débito de uma vez. São ~5 minutos.

**8a — guard de rota, DESLOGADO.**

- **Pré-condição:** **saia da sessão** (logout, ou use uma janela anônima).
- **Ação:** digitar na barra de endereço, uma de cada vez:
  - `/dashboard`
  - `/dashboard/links`
  - `/dashboard/analytics`
- **Resultado esperado:** **as três** redirecionam para `/login`. Nenhuma exibe, nem por um instante, conteúdo do dashboard. *(Existem duas barreiras aqui também: o middleware na borda e o guard no layout do dashboard — se uma falhar, a outra segura.)*
- [ ] Passo 8a OK

**8b — console limpo de CSP, LOGADO, nos 3 temas.**

- **Pré-condição:** logar de novo. Abrir **DevTools → aba Console** (deixe aberta o tempo todo).
- **Ação:** para **cada um dos 3 temas** (`base`, `accent` e o terceiro do seletor), trocar o tema e então navegar por:
  `/dashboard` → `/dashboard/links` → `/dashboard/analytics` → `/{seu_username}`.
  Em cada página, olhe o Console.
- **Resultado esperado:** **ZERO violação de Content Security Policy**. Uma violação aparece em vermelho com o texto característico *"Refused to … because it violates the following Content Security Policy directive: …"*. Qualquer linha assim é **falha do passo** — anote a diretiva citada (`script-src`, `style-src`, `img-src`, `connect-src`…) e a URL bloqueada.
- **Atenção especial ao `connect-src`:** se o login ou os dados do dashboard não carregarem **e** o Console mostrar bloqueio de uma URL `*.supabase.co`, o sintoma é `NEXT_PUBLIC_SUPABASE_URL` ausente **no momento do build** — a CSP é montada em `next.config.ts`. É um modo de falha novo do Epic 6 e não gera nenhum erro do lado do servidor.
- *Avisos que **não** são violação de CSP (warnings de React, 404 de favicon, mensagens do HMR em dev) não contam.*
- [ ] Passo 8b OK

### 9. Rate limiting nos endpoints de auth (FR21/NFR18) *(SMOKE-D — novo no Epic 6)*

> 🛑 **FAÇA ESTE PASSO POR ÚLTIMO. Não antecipe.**
> Ele **queima de propósito** os baldes de rate limit do **seu próprio IP** — `reset` por até **1 hora** e `login` por **15 minutos**. Se você rodar antes, os passos 1, 2 e 7 ficam bloqueados e você vai diagnosticar o bloqueio como bug. Se precisar refazer algum passo anterior, faça **antes** de começar aqui.
>
> ⚠️ Se você já executou o passo 7, o balde `reset` já tem **1 consumo**: o bloqueio em 9a pode vir na 3ª tentativa em vez da 4ª. Isso **é** o comportamento correto — o limite é 3 por hora, contando tudo.

**9a — reset de senha (limite: 3/hora).**

- **Ação:** em `/reset-password`, solicitar o reset com o **mesmo e-mail**, 4 vezes seguidas.
- **Resultado esperado:** a partir da 4ª (ou 3ª, ver aviso acima) a tela exibe a mensagem **genérica**:
  > *Muitas tentativas. Aguarde alguns minutos e tente novamente.*
  A mensagem **não** pode revelar contador, tempo restante, limite nem a palavra "rate limit". A página **não** pode quebrar nem mostrar erro 500.
- [ ] Passo 9a OK

**9b — login com senha errada (limite: 10 por 15 min).**

- **Ação:** em `/login`, tentar entrar **11 vezes** com o e-mail correto e uma **senha errada**.
- **Resultado esperado:** as 10 primeiras dão o erro normal de credencial inválida; a **11ª** exibe a **mesma mensagem genérica** de 9a. Note que a mensagem é **idêntica** — o bloqueio não se distingue de uma senha errada.
- [ ] Passo 9b OK

**9c — a mensagem não enumera contas.**

- **Ação:** ainda com o balde estourado, pedir um reset em `/reset-password` usando um e-mail que **com certeza não existe** (ex.: `naoexiste-9c@example.com`).
- **Resultado esperado:** **exatamente a mesma mensagem**, palavra por palavra, que apareceu para o e-mail real. Comparar as duas telas lado a lado.
- **Por que isso importa:** se a resposta fosse diferente para conta existente e inexistente, qualquer pessoa poderia descobrir **quem tem conta** no produto só pela mensagem de erro. Uma mensagem única e chata é o controle.
- [ ] Passo 9c OK

> **Depois deste passo, seu IP fica limitado por até 1 hora.** Se precisar voltar a usar o app já, troque de rede (ex.: 4G do celular) ou espere a janela expirar. Não é defeito.

---

## Resultado do smoke

- [ ] Todos os **9 passos** (incluindo 2b, 8a, 8b, 9a-9c) passaram → **release candidate validado**.
- Registrar data/versão/navegadores no PR do release candidate.
- O passo **2b** é o que fecha a **AC7 da Story 6.6** — nenhum agente pode assiná-la, só o owner.

## Notas

- O `@` de `/@username` é **display-only** — a URL real é `/{username}` (sem `@`).
- Revalidação da página pública é ISR (~60s); force reload se a ordem parecer defasada logo após reordenar. *(Débito conhecido `DEBT-001`: a rota declara `revalidate=60` mas hoje responde `no-store` — na prática a página é sempre fresca.)*
- **A partir do Epic 6, RLS e rate limiting estão ATIVOS** — a nota anterior ("sem RLS no MVP; sem rate limiting ativo no MVP") não vale mais. O que isso muda no comportamento observável está detalhado nos passos 4 (SMOKE-B), 5 (SMOKE-F) e 9.
- **O rate limiting é fail-open de propósito:** se a checagem de limite falhar (banco fora do ar, erro de rede), ela **libera** em vez de bloquear. Um limiter quebrado nunca derruba o produto. Consequência para o smoke: se o passo 9 **não** bloquear, isso pode significar limiter inativo — investigar, não ignorar.

---

## Itens que dependem de humano / @devops (não bloqueiam o código)

Estes itens fazem parte da declaração formal de MVP entregue, mas **não são código** e **não bloqueiam** o merge desta story. São de responsabilidade do **owner** e do **@devops**:

- [ ] **Execução deste smoke test** pelo owner (interação real com e-mail + 2 navegadores). *(owner)*
- [ ] **3 reproduções externas** do setup local — 3 devs externos clonam, configuram `.env.local` (apontando ao Supabase `development` ou próprio) e rodam seguindo o README; registrar em **issues ou discussion** no GitHub (PRD Story 5.6 AC4; depende de divulgação mínima — checklist item M2). *(owner)*
- [ ] **Tag de release `v0.1.0`** na `main` (PRD Story 5.6 AC5). *(@devops — push/tag é autoridade exclusiva do @devops)*
- [ ] **Promover o Change Log do PRD para `1.0`** — versão final do MVP (PRD Story 5.6 AC5). *(owner/@pm)*
