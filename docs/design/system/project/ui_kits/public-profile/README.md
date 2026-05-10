# Public Profile UI Kit

Recreates the **`/@username`** page — minimalist, mobile-first, SSR-rendered. Single centered column, max-width 480px. Renders avatar, display name, bio (≤160 chars), and a list of active links ordered by position. Clicking a link tracks via `trackLinkClick` Server Action then opens in a new tab.

This kit demonstrates the same page across all 3 themes — switch via the segmented control in the corner.

## Components

- `PublicProfile.jsx` — top-level layout (avatar + name + bio + link list)
- `LinkButton.jsx` — single tappable link row with hover/press

## Source

Architecture § 10.3.2 (`app/[username]/page.tsx`), PRD FR14–FR16, Story 3.5.
