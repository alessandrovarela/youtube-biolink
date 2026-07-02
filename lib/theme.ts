// Story 4.3 — helpers puros de tema (reutilizados pela página pública na 4.4).
// Fonte de verdade dos temas e classes: app/globals.css
//   light  → :root (default, sem classe)
//   dark   → html.theme-dark
//   accent → html.theme-accent
// Paridade com o CHECK do banco: profiles.theme IN ('light','dark','accent').

export const THEMES = ['light', 'dark', 'accent'] as const;

export type Theme = (typeof THEMES)[number];

/** Type guard: `value` é um Theme válido ('light' | 'dark' | 'accent'). */
export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Normaliza um valor (possivelmente inválido/nulo) para um Theme válido.
 * Fallback `light` — defense-in-depth além do CHECK do banco (AC4).
 */
export function resolveTheme(value?: string | null): Theme {
  return isTheme(value) ? value : 'light';
}

/**
 * Classe CSS a aplicar no `<html>` para o tema informado.
 * - light (ou qualquer valor inválido/nulo) → '' (usa os tokens de :root)
 * - dark   → 'theme-dark'
 * - accent → 'theme-accent'
 * Aceita string livre para tolerar valores vindos do banco (AC4).
 */
export function resolveThemeClass(theme?: string | null): string {
  switch (theme) {
    case 'dark':
      return 'theme-dark';
    case 'accent':
      return 'theme-accent';
    default:
      return ''; // light e qualquer valor inesperado caem no default (light)
  }
}
