# youtube-biolink

> Criado com Synkra AIOX

## Visão Geral

Projeto inicializado via `@devops *environment-bootstrap`.

## Getting Started

```bash
# Adicione scripts de dev/build/test conforme o stack escolhido
```

## Documentação

### Artefatos canônicos

- [Project Brief](docs/brief.md) — visão de produto, contexto e proposta de valor (v1.0, @analyst)
- [PRD](docs/prd.md) — requisitos funcionais, NFRs, epics e stories (v1.1, @pm)
- [Arquitetura](docs/architecture.md) — stack, rotas, schema, decisões técnicas (@architect)
- [Frontend Spec](docs/frontend-spec.md) — mapa UX-1..UX-9, tokens, drag-and-drop a11y (v1.0, @ux-design-expert)

### Design system

- [Design System](docs/design/system/) — tokens, voz/tom, ícones, preview cards, ui kits
- [Protótipos](docs/design/prototypes/) — canvas React com as 9 core screens nos 3 temas

O design system também é exposto como Claude Code skill em `.claude/skills/biolink-design` (symlink) — qualquer agente pode invocá-lo durante implementação.

### Trabalho iterativo

- [Stories](docs/stories/) — uma story por unidade de desenvolvimento (a popular pelo @sm)
- [Architecture (sharded)](docs/architecture/) — versão fragmentada para consumo por agentes (gerada sob demanda)
- [Guides](docs/guides/) — guias e tutoriais didáticos (gerados durante o desenvolvimento)

## Workflow AIOX

1. `@analyst *create-doc project-brief` — Project Brief
2. `@pm *create-doc prd` — PRD
3. `@architect` — Arquitetura
4. `@ux-design-expert *create-front-end-spec` — Frontend Spec
5. `@sm *draft` → `@po *validate-story-draft` → `@dev *develop-story` → `@qa *qa-gate` → `@devops *push`

---
*Gerado por AIOX Environment Bootstrap*
