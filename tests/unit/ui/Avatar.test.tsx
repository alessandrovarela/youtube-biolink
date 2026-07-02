import { render, screen, fireEvent } from '@testing-library/react';
import { Avatar, getInitials } from '@/components/ui/Avatar';

describe('getInitials', () => {
  it('deriva 2 letras de primeira + última palavra', () => {
    expect(getInitials('Alessandro Varela')).toBe('AV');
  });
  it('nome único usa as 2 primeiras letras', () => {
    expect(getInitials('alessandro')).toBe('AL');
  });
  it('vazio/ausente retorna ?', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials(null)).toBe('?');
  });
});

describe('Avatar', () => {
  it('mostra iniciais no fallback quando não há src', () => {
    render(<Avatar displayName="Alessandro Varela" />);
    expect(screen.getByText('AV')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renderiza a imagem quando há src', () => {
    render(<Avatar src="https://x/y.png" displayName="Alessandro Varela" alt="avatar" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('cai para as iniciais quando a imagem falha (onError/404)', () => {
    render(<Avatar src="https://x/broken.png" displayName="Alessandro Varela" alt="avatar" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('AV')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
