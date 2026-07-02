// Story 4.3 — teste do seletor de tema (Aparência).
// Verifica: renderiza 3 swatches, indica o selecionado, e ao clicar aplica a
// classe no <html> instantaneamente + chama a Server Action updateTheme.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { updateTheme } = vi.hoisted(() => ({
  updateTheme: vi.fn(async () => ({ ok: true }) as { ok: true }),
}));
vi.mock('@/lib/actions/profile', () => ({ updateTheme }));

import { ThemeProvider } from '@/components/dashboard/theme-provider';
import { ThemeSelector } from '@/components/dashboard/theme-selector';

function renderWithProvider(initialTheme: 'light' | 'dark' | 'accent' = 'light') {
  return render(
    <ThemeProvider initialTheme={initialTheme}>
      <ThemeSelector />
    </ThemeProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.className = '';
});

describe('ThemeSelector', () => {
  it('renderiza os 3 swatches como radios', () => {
    renderWithProvider('light');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /light/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /dark/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('ao selecionar dark: aplica theme-dark no <html> e persiste via updateTheme', async () => {
    const user = userEvent.setup();
    renderWithProvider('light');

    await user.click(screen.getByRole('radio', { name: /dark/i }));

    // Aplicação instantânea no <html>.
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    // Estado de seleção atualizado.
    expect(screen.getByRole('radio', { name: /dark/i })).toHaveAttribute('aria-checked', 'true');
    // Persistência chamada com o tema correto.
    await waitFor(() => expect(updateTheme).toHaveBeenCalledWith('dark'));
  });

  it('ao selecionar accent aplica theme-accent (removendo classe anterior)', async () => {
    const user = userEvent.setup();
    renderWithProvider('dark');
    document.documentElement.classList.add('theme-dark');

    await user.click(screen.getByRole('radio', { name: /accent/i }));

    expect(document.documentElement.classList.contains('theme-accent')).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
  });

  it('reverte o tema e mostra erro quando a persistência falha', async () => {
    updateTheme.mockResolvedValueOnce({
      ok: false,
      error: 'Não foi possível salvar o tema',
    } as never);
    const user = userEvent.setup();
    renderWithProvider('light');

    await user.click(screen.getByRole('radio', { name: /dark/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar o tema')
    );
    // Reverteu para light.
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(screen.getByRole('radio', { name: /light/i })).toHaveAttribute('aria-checked', 'true');
  });
});
