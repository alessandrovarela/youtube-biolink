// Story 4.3 — ThemeProvider client-side.
// Aplica a classe de tema no <html> de forma INSTANTÂNEA (sem reload) ao trocar
// e evita flash no primeiro paint via script inline síncrono renderizado no SSR
// (o tema inicial vem server-side do profile.theme, resolvido em resolveTheme).
'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { resolveThemeClass, type Theme } from '@/lib/theme';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme deve ser usado dentro de <ThemeProvider>');
  }
  return ctx;
}

/** Aplica a classe do tema no <html>, removendo as demais (idempotente). */
function applyThemeClass(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove('theme-dark', 'theme-accent');
  const cls = resolveThemeClass(theme);
  if (cls) root.classList.add(cls);
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeClass(next); // aplicação instantânea, sem reload
  }, []);

  // No-flash: aplica a classe antes do paint. Como o tema já é conhecido no SSR,
  // renderizamos um script síncrono com a classe exata (sem lógica embutida).
  const bootClass = resolveThemeClass(initialTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {bootClass && (
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add(${JSON.stringify(bootClass)})`,
          }}
        />
      )}
      {children}
    </ThemeContext.Provider>
  );
}
