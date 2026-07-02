# Smoke Test Manual — MVP (ponta a ponta)

> Roteiro de validação **manual** do fluxo completo do MVP: signup → perfil/tema → links → página pública → clique → analytics, mais o **reset de senha por e-mail**.
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
- Recomendado: começar com um username novo para não colidir com dados anteriores.

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

### 5. Clicar em 2 dos links (verificar nova aba) (FR15, FR19)

- **Pré-condição:** página pública aberta no navegador anônimo (passo 4).
- **Ação:** clicar em **2** dos links ativos.
- **Resultado esperado:** cada link **abre em nova aba** (`target="_blank" rel="noopener noreferrer"`). Cada clique registra um evento (`link_id`, `clicked_at` server-side, user-agent truncado) via Server Action — sem endpoint público cru exposto.
- [ ] Passo 5 OK

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

---

## Resultado do smoke

- [ ] Todos os 7 passos passaram → **release candidate validado**.
- Registrar data/versão/navegadores no PR do release candidate.

## Notas

- O `@` de `/@username` é **display-only** — a URL real é `/{username}` (sem `@`).
- Revalidação da página pública é ISR (~60s); force reload se a ordem parecer defasada logo após reordenar.
- Débitos conhecidos que **não bloqueiam** o smoke: sem RLS no MVP (defesa em profundidade fica no Epic 6); sem rate limiting ativo no MVP (Epic 6).

---

## Itens que dependem de humano / @devops (não bloqueiam o código)

Estes itens fazem parte da declaração formal de MVP entregue, mas **não são código** e **não bloqueiam** o merge desta story. São de responsabilidade do **owner** e do **@devops**:

- [ ] **Execução deste smoke test** pelo owner (interação real com e-mail + 2 navegadores). *(owner)*
- [ ] **3 reproduções externas** do setup local — 3 devs externos clonam, configuram `.env.local` (apontando ao Supabase `development` ou próprio) e rodam seguindo o README; registrar em **issues ou discussion** no GitHub (PRD Story 5.6 AC4; depende de divulgação mínima — checklist item M2). *(owner)*
- [ ] **Tag de release `v0.1.0`** na `main` (PRD Story 5.6 AC5). *(@devops — push/tag é autoridade exclusiva do @devops)*
- [ ] **Promover o Change Log do PRD para `1.0`** — versão final do MVP (PRD Story 5.6 AC5). *(owner/@pm)*
