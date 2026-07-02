// Utilitário mínimo para compor classNames condicionais sem dependências externas.
// (Story 4.2 — não instalamos clsx/cva; mantemos o design system self-contained.)
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
