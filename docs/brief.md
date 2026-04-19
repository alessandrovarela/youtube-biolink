# Project Brief: youtube-biolink

> **Status:** Draft v1.0
> **Autor:** Atlas (Business Analyst) em colaboração com Alessandro Varela
> **Data:** 2026-04-16
> **Projeto:** youtube-biolink — aplicativo de gerenciamento de links estilo Linktree
> **Propósito:** Didático — ensinar outras pessoas desenvolvimento fullstack moderno

---

## Executive Summary

**Produto:** Aplicação web didática de bio-link (agregador de links pessoal, estilo Linktree) construída com **Next.js + Supabase**, servindo como projeto de estudo público para ensinar desenvolvimento fullstack moderno end-to-end.

**Problema:** Desenvolvedores em transição para stacks modernas (Next.js + BaaS) carecem de projetos-tutorial que cubram, em um único produto real, o espectro completo — autenticação, RLS, SSR, design system, analytics e CI/CD — sem simplificações que escondem os desafios reais de produção.

**Mercado-alvo:**
- **Primário (aprendizes):** Desenvolvedores junior/pleno que querem aprender Next.js + Supabase em um produto concreto.
- **Secundário (usuários finais):** Criadores, profissionais e qualquer pessoa que precise consolidar múltiplos links em uma página compartilhável.

**Proposta de valor-chave:** Um projeto open-source de referência que funciona como produto real (utilizável por qualquer nicho) *e* como currículo prático, ensinando **6 pilares fullstack** (Auth, DB/RLS, SSR, CI/CD, Analytics, Design System) através de um caso de uso familiar, com escopo bem delimitado.

---

## Problem Statement

### Estado Atual e Dores

O ensino de desenvolvimento fullstack moderno vive num paradoxo: **tutoriais são abundantes, mas fragmentados**. Aprendizes encontram facilmente:

- Tutoriais de "to-do list" que não tocam autenticação real nem RLS
- Cursos de Next.js que ignoram o backend
- Vídeos de Supabase isolados, sem um produto-vitrine coeso
- Projetos "fullstack" que pulam CI/CD, analytics ou design system porque "foge do escopo"

O resultado é um aprendiz que conhece **partes** da stack, mas **nunca conectou todas num produto publicável**.

### Impacto do Problema

- **Curva de integração:** na primeira experiência real, o dev trava ao conectar RLS + SSR + auth cookies, porque nenhum tutorial mostrou essa junção em contexto.
- **Lacuna de portfólio:** projetos de estudo parecem estudo (hard-coded, sem deploy, sem analytics) — não convencem recrutadores de que o candidato entrega produto.
- **Abandono:** sem um projeto-âncora que una os pilares, aprendizes migram entre tutoriais sem consolidar conhecimento prático.

### Por Que Soluções Existentes Falham

| Abordagem | Lacuna |
|-----------|--------|
| Tutoriais curtos (YouTube, artigos) | Cobrem 1 pilar, ignoram integração |
| Cursos pagos | Focam em *features*, raramente mostram deploy + CI/CD + observabilidade |
| Templates starter (ex.: `create-t3-app`) | Dão o esqueleto, mas não ensinam o *porquê* das decisões |
| Clonar Linktree em vídeo | Entrega a feature, sem Auth real, RLS, design system, analytics ou pipeline |

### Urgência — Por Que Agora

- **Next.js 15 + App Router + RSC** mudaram o jeito de fazer fullstack em 2024-2025. Material didático atualizado ainda é escasso.
- **Supabase** consolidou-se como BaaS de referência para devs não-enterprise — a janela para um projeto-referência público está aberta.
- Projetos didáticos de 2021-2022 (Pages Router, client-side everything) estão **obsoletos** para as práticas atuais.

---

## Proposed Solution

### Conceito Central

Um **biolink funcional e publicável**, construído progressivamente em público, com Next.js 15 (App Router + RSC) + Supabase, servindo simultaneamente como:

1. **Produto real** — qualquer pessoa pode criar conta, configurar sua página, compartilhar `dominio.com/@usuario`.
2. **Currículo didático estruturado** — o código-fonte, commits, stories e documentação formam o material de ensino.

A aprendizagem emerge do **processo de construção**, não de exercícios artificiais.

### Abordagem por Pilar Didático

| Pilar | Como é ensinado no projeto |
|---|---|
| **Autenticação** | Supabase Auth com **e-mail + senha** (signup, login, verificação de e-mail, reset de senha), cookies server-side, middleware Next |
| **Banco + RLS** | Schema relacional (users, pages, links, clicks), políticas RLS por linha, migrations versionadas |
| **SSR/Componentes** | App Router + RSC para páginas públicas, Server Actions para mutações do dashboard |
| **CI/CD** | GitHub Actions → typecheck/lint/test → deploy Vercel; migrations Supabase em pipeline |
| **Analytics** | Contagem de cliques por link, agregação server-side, dashboard com charts |
| **Design System** | Tokens, primitivos (Button, Input, Card), **3 temas pré-definidos** selecionáveis pelo usuário, documentação viva |

### Diferenciais-Chave

- **Integrado, não fragmentado:** os 6 pilares são ensinados *dentro do mesmo produto*, não em módulos isolados.
- **Código que vai para produção:** nada de `TODO: handle error later` — tratamento de erros, loading states, edge cases são parte do currículo.
- **Commits como material didático:** conventional commits com referência a stories; `git log` vira leitura obrigatória.
- **Stories narráveis:** cada feature nasce como story no formato `{epic}.{story}.md` com contexto, AC, decisões — o aprendiz vê *o que* e *por que*.
- **Open-source + reproduzível:** qualquer um clona, configura `.env.local`, e roda em <15 min.

### Por Que Esta Solução Pode Ter Sucesso

- **Formato espelha o mundo real:** issue → story → branch → PR → review → deploy. Quem aprende aqui já pratica o fluxo profissional.
- **Stack de alta empregabilidade:** Next.js + Supabase é combinação pedida no mercado para posições pleno/senior.
- **Escopo enxuto evita overwhelm:** biolink é domínio familiar — aprendiz não gasta energia entendendo regras de negócio, foca na *engenharia*.
- **Assíncrono e auto-didata:** diferente de curso com turma, aluno avança no próprio ritmo pelo repositório.

### Visão de Alto Nível

> *"Um repositório que funciona como livro vivo: cada commit é uma aula, cada story é um capítulo, cada deploy é um exercício validado em produção."*

O produto final é um biolink aceitavelmente bonito e funcional; o *subproduto* é o dev que terminou o trajeto sabendo construir SaaS do zero.

---

## Target Users

### Primary User Segment: Aprendiz Fullstack em Transição

- **Perfil demográfico/profissional:** Desenvolvedor(a) junior a pleno, 1-4 anos de experiência, tipicamente vindo de frontend (React puro) ou backend (Node REST) puro. Pode também ser graduado de bootcamp buscando primeiro projeto portfolio-worthy.
- **Comportamento atual:** Consome tutoriais no YouTube, Udemy, docs oficiais. Alterna entre cursos sem consolidar. Tem 5-10 projetos pela metade no GitHub.
- **Dores específicas:**
  - Sabe React, mas trava em SSR e server state
  - Nunca configurou RLS ou pensou em segurança de linha
  - CI/CD é "coisa do time de DevOps"
  - Design system parece over-engineering
- **Objetivo:** Ter **um projeto completo** que represente capacidade fullstack moderna para portfólio e/ou evolução técnica pessoal.

### Secondary User Segment: Usuário Final do Biolink

- **Perfil:** Criadores de conteúdo, freelancers, profissionais liberais, pequenos negócios. Idade 18-45, alfabetização digital média-alta.
- **Comportamento atual:** Usam Linktree, Beacons, Bio.link ou uma página estática no Instagram.
- **Dores:**
  - Linktree com free tier limitado e ads
  - Soluções pagas sem controle sobre dados
- **Objetivo:** Criar uma página simples que agrega 3-15 links, acessível via URL compartilhável.
- **Observação:** polish visual e features avançadas não são prioridade — usabilidade básica e página leve bastam.

---

## Goals & Success Metrics

### Business Objectives (adaptados ao contexto didático)

- **Cobertura didática:** 100% das features do MVP têm story documentada com contexto, AC e decisões técnicas
- **Reprodutibilidade:** Dev externo clona e roda localmente em <15 min seguindo o README
- **Integralidade curricular:** Todos os 6 pilares (Auth, DB/RLS, SSR, CI/CD, Analytics, Design System) aparecem em código e documentação
- **Publicação em produção:** MVP deployed e acessível publicamente via URL estável

### User Success Metrics

**Aprendiz:**
- Consegue subir versão local própria em ≤1 semana de estudo part-time
- Ao ler uma story + commits associados, entende o *porquê* das decisões técnicas
- Após concluir leitura do repo, sente-se confortável para adicionar 1 feature nova

**Usuário final:**
- Cria conta, configura 5 links e publica página em <5 minutos
- Página pública carrega com LCP <2.5s em conexão 4G

### Key Performance Indicators (KPIs)

- **Story coverage:** % de features com story documentada — meta: 100%
- **Time-to-first-link:** mediana do tempo entre signup e primeiro link salvo — meta: <3 min
- **Deploy uptime:** disponibilidade da instância de referência — meta: ≥99%
- **Reproduzibilidade:** nº de devs externos que conseguem subir o projeto localmente — meta: ≥3 até final do MVP
- **GitHub stars:** sinal secundário de adoção didática (sem meta numérica)
- **Issues/PRs da comunidade:** indicador qualitativo de engajamento educacional

---

## MVP Scope

### Core Features (Must Have)

- **Autenticação com e-mail + senha:** signup com verificação de e-mail, login com credenciais, reset de senha via e-mail, logout; Supabase Auth nativo (sem OAuth/magic link no MVP); middleware de proteção de rotas
- **Dashboard autenticado:** perfil editável (nome, bio, URL de avatar), CRUD de links, drag-and-drop para reordenar, seletor de tema
- **Página pública (`/@username`):** renderizada via SSR com avatar, bio, lista de links clicáveis e tema escolhido pelo usuário
- **Row Level Security completa:** políticas em todas as tabelas garantindo que usuário só acesse seus dados
- **Analytics básico:** contagem de cliques por link, agregados diários, dashboard com totais por período
- **Design system com 3 temas pré-definidos:** design tokens (cores, spacing, typography), primitivos (Button, Input, Avatar, Card), **3 temas selecionáveis** pelo usuário (ex.: `light`, `dark`, `accent`)
- **Pipeline CI/CD:** GitHub Actions com typecheck + lint + test + deploy automático na main
- **Migrations versionadas:** schema evolutivo via `supabase/migrations/`
- **Documentação:** README com setup local, arquitetura do repo, convenções, guia de contribuição

### Out of Scope for MVP

- Temas fully-customizáveis (color picker, CSS personalizado) — MVP limita a 3 temas pré-definidos
- Autenticação social / OAuth (Google, GitHub, etc.) e magic link — MVP usa apenas e-mail + senha
- Upload de avatar nativo (MVP usa URL externa / gravatar)
- Domínios customizados (apenas path-based no domínio do projeto)
- Integrações sociais (auto-importar links do Instagram, etc.)
- Planos pagos / paywall / billing
- Multi-idioma (i18n) — MVP em pt-BR
- Notificações por email
- Exportação/backup de dados
- Modo "exercícios didáticos" embutido no app

### MVP Success Criteria

O MVP é considerado entregue quando:

1. Todas as core features implementadas com stories documentadas e AC cumpridas
2. Deploy funcional em produção (Vercel + Supabase Cloud) e URL pública estável
3. Pipeline CI/CD rodando verde na branch `main`
4. Documentação completa permite que um dev externo clone e rode em <15 min
5. Pelo menos 3 outras pessoas conseguem reproduzir o setup seguindo o README

---

## Post-MVP Vision

### Phase 2 Features

- Theming totalmente customizável (color picker, fontes, CSS por usuário) expandindo os 3 temas do MVP
- Biblioteca expandida de templates/temas (ex.: "minimal", "neon", "corporate") além dos 3 iniciais
- Autenticação social / OAuth (Google, GitHub, Apple) e/ou magic link adicionados ao e-mail + senha do MVP
- Domínios customizados com validação DNS
- Upload nativo de assets (avatar, thumbnails de link) via Supabase Storage
- Social proof automático (ícones reconhecidos de YouTube, Instagram, TikTok, etc.)
- Analytics avançado (país via header, referrer, horário)
- Scheduling e expiração de links

### Long-term Vision (1-2 anos)

- Tornar-se projeto-referência citado em cursos, artigos e comunidades sobre Next.js + Supabase
- Versão fork-friendly com docs em EN para alcance global
- Série companheira de blog posts / vídeos detalhando decisões técnicas
- Capítulo de livro open-source baseado no projeto
- Template oficial listado nos `create-next-app` examples

### Expansion Opportunities

- **Variantes multi-stack** do mesmo domínio (Astro, Remix, SvelteKit) — estudo comparativo didático
- **Módulo testing masterclass** com cobertura E2E (Playwright) + unit (Vitest) + integration
- **Módulo observabilidade** adicionando logs estruturados, traces, error tracking (Sentry, Axiom)
- **Pacote de exercícios** guiados para o aprendiz praticar adições incrementais ao projeto

---

## Technical Considerations

### Platform Requirements

- **Target Platforms:** Web (responsive desktop + mobile)
- **Browser/OS Support:** Evergreen browsers (Chrome, Firefox, Safari, Edge — últimas 2 versões estáveis)
- **Performance Requirements:** LCP <2.5s, TTI <3s em conexão 4G; cache agressivo para páginas públicas; bundle inicial <150KB gzipped

### Technology Preferences

- **Frontend:** Next.js 15 (App Router + React Server Components), TypeScript strict, Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + Storage); Server Actions para mutações; Route Handlers apenas para webhooks/integrações externas
- **Database:** Postgres gerenciado pelo Supabase; migrations versionadas em `supabase/migrations/`; RLS obrigatória em todas as tabelas
- **Hosting/Infrastructure:** Vercel (frontend + serverless functions); Supabase Cloud (Postgres gerenciado); domínio próprio com DNS via Cloudflare (opcional)

### Architecture Considerations

- **Repository Structure:** Monorepo simples — pasta raiz do Next.js app, diretório `supabase/` para migrations e funções SQL, diretório `docs/` para brief/PRD/architecture/stories
- **Service Architecture:** Monolito Next.js + Supabase como BaaS — sem microserviços para manter simplicidade didática
- **Integration Requirements:** Supabase SDK (clientes server e browser separados), envio de e-mails transacionais do Supabase Auth (verificação de conta e reset de senha) via SMTP padrão do projeto ou SMTP customizado, opcionalmente Vercel Analytics
- **Security/Compliance:**
  - RLS em todas as tabelas
  - HTTPS exclusivo
  - Sanitização de URLs (bloquear schemes `javascript:`, `data:` em links)
  - Rate limiting em endpoints de criação/login
  - CSP headers básicos
  - Secrets via variáveis de ambiente (nunca no repo)

---

## Constraints & Assumptions

### Constraints

- **Budget:** $0 — free tiers de Vercel + Supabase; domínio opcional (~$12/ano)
- **Timeline:** Sem deadline rígido (projeto didático); estimativa informal de 8-12 semanas para MVP em ritmo part-time
- **Resources:** 1 desenvolvedor principal (Alessandro Varela); contribuições comunitárias são bem-vindas mas não esperadas
- **Technical:** Limites de free tier:
  - Supabase: 500MB DB, 1GB Storage, 50k MAU, 2 projetos
  - Vercel: 100GB bandwidth/mês, execução serverless limitada
  - GitHub Actions: 2000 minutos/mês no plano free

### Key Assumptions

- Existe audiência real de aprendizes interessada em tutoriais integrados de Next.js + Supabase
- Supabase mantém free tier generoso em 2026+
- Next.js 15 (App Router + RSC) é estável o suficiente para base de projeto didático de longo prazo
- Aprendizes primários já possuem conhecimento básico de JavaScript/TypeScript e Git
- Documentação em português atende a maioria da audiência-alvo inicial (EN fica para Phase 2)
- Conventional commits + stories estruturadas se mantêm consistentes ao longo do projeto

---

## Risks & Open Questions

### Key Risks

- **Obsolescência rápida:** Next.js e Supabase evoluem rapidamente; material pode ficar defasado em 6-12 meses sem manutenção ativa — *mitigação: marcar versão de cada dependência no README e abrir issues de atualização periódicas*
- **Escopo didático infla:** tentação de "adicionar mais um exemplo" pode atrasar MVP indefinidamente — *mitigação: respeitar lista Out of Scope, adiar adições para Phase 2*
- **Disciplina de commits degradada:** valor didático depende de qualidade de commits/stories — *mitigação: conventional commits + pre-commit hooks + template de story obrigatório*
- **Baixa descoberta:** repositório excelente sem canal de distribuição (blog/vídeos/comunidade) não alcança aprendizes — *mitigação: plano de divulgação em Phase 2 (posts técnicos, seções em comunidades br de devs)*
- **Sobrecarga técnica para junior:** decisões avançadas (RSC, Server Actions, RLS) podem assustar aprendiz junior — *mitigação: docs introdutórias por pilar + glossário + "pré-requisitos recomendados"*
- **Mudanças em free tier:** Vercel ou Supabase podem reduzir limites e inviabilizar reprodução gratuita — *mitigação: documentar alternativas (Netlify, self-hosted Supabase) no README*

### Open Questions

- Idioma principal do material didático: pt-BR, en-US ou ambos desde o MVP?
- Será acompanhado de vídeos/blog posts companheiros, ou repositório é 100% self-contained?
- Nível mínimo presumido: só JS básico, ou TypeScript + React prévio?
- Como validar progresso do aprendiz — checkpoints, exercícios guiados, quizzes?
- Licença será MIT, Apache 2.0 ou algo específico para material educativo (ex.: CC BY-SA para docs)?
- Haverá seção "migração Pages Router → App Router" para ajudar quem vem do formato antigo?

### Areas Needing Further Research

- Benchmarking de projetos-tutorial bem-sucedidos (Taxonomy do shadcn, create-t3-app, Josh Tried Coding, Fireship)
- Estrutura ideal de stories didáticas — comparar formatos usados em livros técnicos (ex.: *99 Bottles of OOP*, *Refactoring*)
- Padrões de RLS em Supabase para multi-tenant — pesquisar melhores práticas e armadilhas comuns
- Formato de docs: README extenso, MDX dentro do app, Docusaurus separado, ou híbrido?
- Estratégias para manter material atualizado com releases de Next.js/Supabase (automações, releases marcadas, branches por versão)

---

## Appendices

### A. Research Summary

Nenhum research formal foi executado antes deste brief. Recomenda-se:
- Executar `*perform-market-research` para mapear formatos de tutoriais integrados atuais
- Executar `*create-competitor-analysis` comparando Linktree, Beacons, Bento, Bio.link como produtos, e Taxonomy/create-t3-app como projetos-tutorial

### B. Stakeholder Input

- **Alessandro Varela** (project owner, instrutor principal) — definiu escopo didático, stack preferida (Next.js + Supabase) e os 6 pilares de aprendizado

### C. References

- Next.js App Router docs: https://nextjs.org/docs/app
- Supabase docs: https://supabase.com/docs
- Supabase RLS guide: https://supabase.com/docs/guides/database/postgres/row-level-security
- Conventional Commits: https://www.conventionalcommits.org/
- AIOX framework: `.aiox-core/` (este repositório)
- Linktree (produto de referência): https://linktr.ee

---

## Next Steps

### Immediate Actions

1. Revisar este brief e solicitar ajustes antes de handoff
2. Executar `*create-competitor-analysis` comparando Linktree, Beacons, Bento e projetos-tutorial similares (Taxonomy, create-t3-app)
3. Handoff para `@pm (Morgan)` iniciar elaboração do PRD seção por seção, com base neste brief
4. Handoff para `@architect (Aria)` validar stack, desenhar arquitetura técnica e estrutura do repositório
5. `@pm` cria **Epic 1 — Fundação** (setup do projeto, auth, dashboard base)
6. `@sm (River)` inicia o draft da primeira story a partir do Epic 1

### PM Handoff

Este Project Brief provê o contexto completo para **youtube-biolink**. Por favor inicie em **PRD Generation Mode**: revise o brief com atenção, trabalhe com o usuário seção por seção conforme o template indica, pedindo esclarecimentos quando necessário e sugerindo melhorias ao longo do caminho.

---

*Brief gerado via AIOX `*create-project-brief` — Atlas (Business Analyst)*
