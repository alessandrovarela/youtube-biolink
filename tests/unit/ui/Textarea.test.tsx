import { render, screen } from '@testing-library/react';
import { Textarea } from '@/components/ui/Textarea';

describe('Textarea', () => {
  it('associa label ao textarea', () => {
    render(<Textarea label="Bio" name="bio" />);
    const el = screen.getByLabelText('Bio');
    expect(el.tagName).toBe('TEXTAREA');
  });

  it('com error seta aria-invalid e expõe a mensagem via role alert', () => {
    render(<Textarea label="Bio" name="bio" error="Muito longo." />);
    const el = screen.getByLabelText('Bio');
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Muito longo.');
  });
});
