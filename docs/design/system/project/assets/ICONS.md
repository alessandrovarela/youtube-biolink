# Icons

The product uses **Lucide** (https://lucide.dev) — outlined, 1.5px stroke, 24px default. See README.md ▸ Iconography for the full mapping.

## Loading

**In production code:** `pnpm add lucide-react` and import per-icon (`import { Plus } from 'lucide-react'`).

**In standalone HTML / previews:** load via CDN as needed:

```html
<!-- as inline svg via fetch -->
<img src="https://unpkg.com/lucide-static@latest/icons/plus.svg" width="20" height="20" alt="" />
```

## Sizing rules

- 16px — paired with text inside small buttons
- 20px — icon-only buttons in chrome
- 24px — standalone or in cards

## Color rule

Always inherits `currentColor`. Never tinted. Never filled.
