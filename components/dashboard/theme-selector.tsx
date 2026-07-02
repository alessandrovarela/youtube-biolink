// Story 4.3 — seletor de tema (card "Aparência").
// 3 swatches clicáveis com preview visual (light/dark/accent), conforme
// docs/design/system/project/preview/theme-selector.html (fonte de verdade).
// Aplicação instantânea via useTheme (sem reload) + persistência otimista
// em profiles.theme através da Server Action updateTheme.
'use client';

import { useState, useTransition } from 'react';
import { updateTheme } from '@/lib/actions/profile';
import { useTheme } from '@/components/dashboard/theme-provider';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { THEMES, type Theme } from '@/lib/theme';

type Swatch = { bg: string; border?: string };

type Option = {
  value: Theme;
  label: string;
  caption: string;
  // Cores fixas do preview (fonte: theme-selector.html) — independem do tema ativo,
  // pois cada swatch mostra a aparência do SEU tema.
  cardBg: string;
  cardFg: string;
  cardBorder: string; // borda quando NÃO selecionado
  strip: [Swatch, Swatch, Swatch];
};

const OPTIONS: Record<Theme, Option> = {
  light: {
    value: 'light',
    label: 'light',
    caption: 'Tema claro',
    cardBg: '#FFFFFF',
    cardFg: '#0F172A',
    cardBorder: '#E2E8F0',
    strip: [{ bg: '#FFFFFF', border: '#E2E8F0' }, { bg: '#F1F5F9' }, { bg: '#2563EB' }],
  },
  dark: {
    value: 'dark',
    label: 'dark',
    caption: 'Tema escuro',
    cardBg: '#0B1220',
    cardFg: '#E5E7EB',
    cardBorder: '#243046',
    strip: [{ bg: '#0B1220', border: '#243046' }, { bg: '#1A2233' }, { bg: '#60A5FA' }],
  },
  accent: {
    value: 'accent',
    label: 'accent',
    caption: 'Marca quente',
    cardBg: '#FAF7F2',
    cardFg: '#1A1410',
    cardBorder: '#E5DBC8',
    strip: [{ bg: '#FAF7F2', border: '#E5DBC8' }, { bg: '#F0E9DD' }, { bg: '#D97757' }],
  },
};

function CheckMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-fg"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function select(next: Theme) {
    if (next === theme || isPending) return;
    const previous = theme;
    setError(null);
    setTheme(next); // aplicação instantânea (otimista)
    startTransition(async () => {
      const res = await updateTheme(next);
      if (!res.ok) {
        setTheme(previous); // reverte em caso de falha
        setError(res.error);
      }
    });
  }

  return (
    <>
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-3">
        {THEMES.map((value) => {
          const opt = OPTIONS[value];
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={isPending}
              onClick={() => select(value)}
              className={cn(
                'flex flex-col gap-2.5 rounded-lg border-2 p-4 text-left transition-transform duration-[var(--duration-fast)]',
                'hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70'
              )}
              style={{
                background: opt.cardBg,
                color: opt.cardFg,
                borderColor: selected ? 'var(--color-accent)' : opt.cardBorder,
              }}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                {opt.label}
                {selected && <CheckMark />}
              </span>
              <span className="flex gap-1.5">
                {opt.strip.map((s, i) => (
                  <span
                    key={i}
                    className="h-7 flex-1 rounded-md"
                    style={{
                      background: s.bg,
                      border: s.border ? `1px solid ${s.border}` : undefined,
                    }}
                  />
                ))}
              </span>
              <span className="text-[11px] opacity-70">
                {selected ? 'Selecionado' : opt.caption}
              </span>
            </button>
          );
        })}
      </div>

      {error && <Toast message={error} variant="error" onDismiss={() => setError(null)} />}
    </>
  );
}
