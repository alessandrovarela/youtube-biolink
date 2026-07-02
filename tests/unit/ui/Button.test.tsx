import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renderiza um <button> real com o texto', () => {
    render(<Button>Salvar</Button>);
    const btn = screen.getByRole('button', { name: 'Salvar' });
    expect(btn.tagName).toBe('BUTTON');
  });

  it('usa type="button" por padrão e respeita type="submit"', () => {
    const { rerender } = render(<Button>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    rerender(<Button type="submit">x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('loading desabilita o botão, marca aria-busy e mostra spinner', () => {
    const { container } = render(<Button loading>Salvar</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('respeita disabled', () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
