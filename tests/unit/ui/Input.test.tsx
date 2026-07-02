import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('associa label ao input via htmlFor/id', () => {
    render(<Input label="E-mail" name="email" />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('com error: seta aria-invalid, role alert e aria-describedby apontando ao erro', () => {
    render(<Input label="E-mail" name="email" error="E-mail inválido." />);
    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const err = screen.getByRole('alert');
    expect(err).toHaveTextContent('E-mail inválido.');
    expect(input.getAttribute('aria-describedby')).toBe(err.id);
  });

  it('sem error mostra o hint e liga aria-describedby ao hint', () => {
    render(<Input label="Nome" name="nome" hint="Aparece no topo." />);
    const input = screen.getByLabelText('Nome');
    expect(input).not.toHaveAttribute('aria-invalid');
    const hint = screen.getByText('Aparece no topo.');
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
  });
});
