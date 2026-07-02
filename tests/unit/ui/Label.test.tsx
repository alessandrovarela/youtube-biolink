import { render, screen } from '@testing-library/react';
import { Label } from '@/components/ui/Label';

describe('Label', () => {
  it('renderiza um <label> associável via htmlFor', () => {
    render(
      <>
        <Label htmlFor="campo">Nome</Label>
        <input id="campo" />
      </>
    );
    const label = screen.getByText('Nome');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', 'campo');
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });
});
