import { render, screen } from '@testing-library/react';
import { Card } from '@/components/ui/Card';

describe('Card', () => {
  it('renderiza os filhos', () => {
    render(
      <Card>
        <p>conteúdo</p>
      </Card>
    );
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('mescla className extra', () => {
    render(<Card className="minha-classe">x</Card>);
    expect(screen.getByText('x')).toHaveClass('minha-classe');
  });
});
