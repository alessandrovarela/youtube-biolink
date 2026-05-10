# Dashboard UI Kit

Recreates the **`/dashboard`** authenticated workspace. Top bar + single centered column (max-width 720px). Tabs across Profile / Links / Analytics. Click-through prototype with optimistic state.

## Components

- `TopBar.jsx` — sticky bar with logo, username chip, sign-out
- `Tabs.jsx` — horizontal tabs (Perfil · Meus links · Analytics)
- `ProfileForm.jsx` — display name, bio, avatar URL + theme picker
- `LinkList.jsx` + `LinkRow.jsx` — CRUD list with toggle, edit, delete, reorder
- `AnalyticsPanel.jsx` — stat cards + simple SVG chart

## Source

Architecture § 10.3.1 (`dashboard/layout.tsx` auth guard), PRD Stories 2.10, 3.3–3.4, 4.3, 5.5.
