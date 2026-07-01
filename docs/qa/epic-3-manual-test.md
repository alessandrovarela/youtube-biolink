# EPIC-3 — Roteiro de Teste Manual (local)

> Para retomar o teste local do Epic 3 (Links & Página Pública).
> Serve também como o smoke manual da Story 3.5 (AC8). Smoke consolidado ponta a ponta vive na Story 5.6.

## Como subir o app
```bash
pnpm dev        # http://localhost:3000 (Next.js 16 + Supabase dev)
```
Dados persistem no **Supabase dev** (tabela `links` já aplicada lá).

## Pré-requisito — estar logado (Epic 2)
- Login: http://localhost:3000/login (conta confirmada).
- Ou signup: http://localhost:3000/signup → confirmar e-mail (Supabase built-in, ~2-4 e-mails/h).

## Roteiro

### 1. Dashboard de links — /dashboard/links (Story 3.3)
- [ ] **Criar** link (título + URL). URL inválida (`javascript:alert(1)`, `ftp://x`) → erro inline. `https://github.com` → cria.
- [ ] **Editar** inline (título/URL).
- [ ] **Toggle** Ativo/Inativo (optimistic).
- [ ] **Deletar** com confirmação inline.
- [ ] (opcional) Criar o **31º** link → erro de limite (máx. 30).

### 2. Reordenação — /dashboard/links (Story 3.4)
- [ ] **Arrastar** pelo handle `⠿` reordena; ordem persiste.
- [ ] Botões **↑/↓** (acessível por teclado) reordenam; foco correto após mover.

### 3. Página pública — /{seu_username} (Story 3.5)
- [ ] Renderiza avatar (ou fallback de iniciais) + display_name + bio.
- [ ] Mostra **só links ativos**, na ordem definida no dashboard.
- [ ] Links abrem em **nova aba** (`rel="noopener noreferrer"`).
- [ ] Link **Inativo** NÃO aparece.
- [ ] `<title>` = `{display_name} (@{username})`.
- [ ] Reordenar no dashboard → recarregar a pública → ordem reflete (revalidate ~60s; force reload).

### 4. 404 custom — /usuario_inexistente (Story 3.5 AC5)
- [ ] Página **404 custom em pt-BR** (`not-found.tsx`).

### 5. Reserved routes (Story 3.6)
- [ ] `/login`, `/dashboard`, `/signup` continuam funcionando (não caem em `[username]`).

## Notas
- O `@` de `/@username` é **display-only** — a URL real é `/{username}` (sem `@`).
- Débitos conhecidos (QA gate): reorder faz N updates sequenciais (ok até 30 links); RLS só no Epic 6.
