import { render, screen, act } from '@testing-library/react';
import { Toast } from '@/components/ui/Toast';

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sucesso/info usam role="status"', () => {
    render(<Toast message="Perfil atualizado." variant="success" />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('Perfil atualizado.');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('erro usa role="alert"', () => {
    render(<Toast message="Falhou." variant="error" />);
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Falhou.');
    expect(el).toHaveAttribute('aria-live', 'assertive');
  });

  it('auto-dismiss chama onDismiss após 5s', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="oi" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
