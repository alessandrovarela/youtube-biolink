// Story 4.4 — Validação de contraste WCAG 2.1 AA para os 3 temas.
// Como não há navegador no ambiente de teste, calculamos a razão de contraste
// (fórmula oficial do W3C) a partir dos hex dos tokens declarados em
// app/globals.css e assertamos os limiares por par crítico.
//
// Limiares WCAG 2.1:
//   - Texto normal (< 18.66px bold / < 24px)  → 1.4.3 AA = 4.5:1
//   - Texto grande / Componentes de UI        → 1.4.3 / 1.4.11 AA = 3.0:1
//
// Pares avaliados por tema:
//   - fg / bg            → texto de corpo (normal)            → ≥ 4.5
//   - muted-fg / bg      → texto secundário/username (normal) → ≥ 4.5
//   - accent-fg / accent → rótulo de botão primário (UI)      → ≥ 3.0
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CSS = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf-8');

/**
 * Extrai o mapa de tokens `--color-*: #hex` do bloco cujo seletor contém
 * `anchor` (ex.: ':root', 'html.theme-dark', 'html.theme-accent').
 */
function tokensOf(anchor: string): Record<string, string> {
  const idx = CSS.indexOf(anchor);
  if (idx === -1) throw new Error(`Seletor não encontrado em globals.css: ${anchor}`);
  const open = CSS.indexOf('{', idx);
  const close = CSS.indexOf('}', open);
  const block = CSS.slice(open + 1, close);
  const out: Record<string, string> = {};
  const re = /--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out[m[1]] = m[2].toLowerCase();
  return out;
}

/** Luminância de canal (sRGB → linear). */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminância relativa (WCAG 2.1). */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste (WCAG 2.1). */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = {
  light: tokensOf(':root'),
  dark: tokensOf('html.theme-dark'),
  accent: tokensOf('html.theme-accent'),
} as const;

describe('Story 4.4 — WCAG AA contrast por tema', () => {
  for (const [theme, t] of Object.entries(THEMES)) {
    describe(`tema ${theme}`, () => {
      it('fg/bg (texto normal) ≥ 4.5:1', () => {
        expect(contrast(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5);
      });

      it('muted-fg/bg (texto secundário) ≥ 4.5:1', () => {
        expect(contrast(t['muted-fg'], t.bg)).toBeGreaterThanOrEqual(4.5);
      });

      it('accent-fg/accent (rótulo em botão — UI/large) ≥ 3.0:1', () => {
        expect(contrast(t['accent-fg'], t.accent)).toBeGreaterThanOrEqual(3.0);
      });
    });
  }

  it('todos os tokens de par foram lidos de globals.css', () => {
    for (const t of Object.values(THEMES)) {
      for (const key of ['fg', 'bg', 'muted-fg', 'accent', 'accent-fg']) {
        expect(t[key]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});
