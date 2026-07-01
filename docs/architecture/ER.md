# Modelo ER Consolidado — youtube-biolink

> **Owner:** @data-engineer (Dara) · **Pré-requisito:** PRE-1 do EPIC-3 (PRD §7 M3)
> **Escopo:** entidades do MVP (Epics 1–3). `link_clicks` (Epic 5) e as RLS
> policies (Epic 6) estão documentadas como *forward-looking* ao final.

## Visão geral

No MVP a autorização é **application-layer** (Server Actions filtram por
`auth.uid()`), sem RLS — o RLS entra no Epic 6 (stories 6.1–6.3). O ER abaixo
reflete o schema **real aplicado** (`profiles`, migration `20260614220038`) e o
schema **planejado** (`links`, Story 3.1).

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "1:1 (trigger on signup)"
    PROFILES  ||--o{ LINKS    : "1:N (on delete cascade)"

    AUTH_USERS {
        uuid id PK "Supabase Auth — gerenciado"
        text email
        jsonb raw_user_meta_data "username no signup"
    }

    PROFILES {
        uuid        id PK "= auth.users.id, FK ON DELETE CASCADE"
        citext      username UK "3-30 chars, ^[a-z][a-z0-9_]*$, único (case-insensitive)"
        text        display_name "nullable"
        text        bio "nullable, <= 160 chars"
        text        avatar_url "nullable"
        text        theme "default 'light', IN (light,dark,accent)"
        timestamptz created_at "default now()"
        timestamptz updated_at "trigger set_updated_at"
    }

    LINKS {
        uuid        id PK "default gen_random_uuid()"
        uuid        profile_id FK "-> profiles.id, ON DELETE CASCADE, NOT NULL"
        text        title "NOT NULL, char_length between 1 and 60"
        text        url "NOT NULL, sanitizado por lib/validation/url.ts (só http/https)"
        int         position "NOT NULL, default 0"
        boolean     is_active "NOT NULL, default true"
        timestamptz created_at "default now()"
        timestamptz updated_at "trigger set_updated_at"
    }
```

## Relacionamentos

| De | Para | Cardinalidade | Regra |
|----|------|---------------|-------|
| `auth.users` | `profiles` | 1:1 | `profiles.id` referencia `auth.users(id)` `ON DELETE CASCADE`. Criado no signup via trigger `on_auth_user_created` → `handle_new_user()` (SECURITY DEFINER). |
| `profiles` | `links` | 1:N | `links.profile_id` referencia `profiles(id)` `ON DELETE CASCADE`. Deletar o profile remove todos os links. |

## Fundações compartilhadas (baseline — Story 1.4)

- **Extensões:** `pgcrypto` (`gen_random_uuid()`), `citext` (username case-insensitive).
- **Função:** `public.set_updated_at()` — reusada pelos triggers `updated_at` de
  `profiles` e (a criar) `links`.

## Índices

| Tabela | Índice | Propósito |
|--------|--------|-----------|
| `profiles` | `UNIQUE (username)` | unicidade case-insensitive (via `citext`) + lookup da página pública por username. |
| `links` | `(profile_id, position)` | ordenação dos links por usuário — leitura do dashboard e da página pública. *(a criar na Story 3.1 AC2.)* |

## Regras de autorização no MVP (sem RLS)

- **Escrita (`links`):** Server Actions (`createLink`/`updateLink`/`deleteLink`/
  `toggleActive`/`reorderLinks`) filtram por `profile_id = auth.uid()`. Usuário A
  não altera links de B.
- **Leitura pública (`/@username`):** query filtra `is_active = true` e
  `profile_id` do username resolvido. Links inativos nunca são expostos.
- **Sanitização de URL:** `sanitizeLinkUrl()` (Story 3.2) roda **antes** de qualquer
  INSERT/UPDATE — só `http(s)` chega ao DB.

## Forward-looking (fora do Epic 3)

| Entidade / mudança | Epic | Nota |
|--------------------|------|------|
| `link_clicks` (id, link_id FK, ts, ip_hash, ...) | Epic 5 | analytics de cliques (Story 5.1). N:1 com `links`. |
| RLS + policies em `profiles` / `links` / `link_clicks` | Epic 6 | stories 6.1/6.2/6.3 — autorização migra do app-layer para o banco. |

---
*Gerado por @data-engineer como input das stories 3.1 (schema) e 5.1 (analytics).*
