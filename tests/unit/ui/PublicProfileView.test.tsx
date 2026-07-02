// Story 4.4 — integração da classe de tema no markup da página pública.
// resolveThemeClass já é coberto por tests/unit/theme.test.ts (4.3); aqui o foco
// é garantir que a view aplica a classe correta no ROOT a partir de profile.theme
// (SSR), preserva os links ativos na ordem e usa target/rel seguros.
import { render, screen, within } from '@testing-library/react';
import { PublicProfileView } from '@/components/public/PublicProfileView';
import type { PublicLink, PublicProfile } from '@/lib/queries/public-page';

function makeProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    username: 'alessandro',
    display_name: 'Alessandro Varela',
    bio: 'Bio de teste',
    avatar_url: null,
    theme: 'light',
    ...overrides,
  };
}

const links: PublicLink[] = [
  { id: '1', title: 'Primeiro', url: 'https://a.example.com', position: 0 },
  { id: '2', title: 'Segundo', url: 'https://b.example.com', position: 1 },
];

function root(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="public-theme-root"]');
  if (!el) throw new Error('root de tema não encontrado');
  return el;
}

describe('PublicProfileView — aplicação de tema (Story 4.4)', () => {
  it('tema light: root SEM classe theme-*', () => {
    const { container } = render(
      <PublicProfileView profile={makeProfile({ theme: 'light' })} links={[]} />
    );
    const el = root(container);
    expect(el.classList.contains('theme-dark')).toBe(false);
    expect(el.classList.contains('theme-accent')).toBe(false);
  });

  it('tema dark: root recebe class theme-dark', () => {
    const { container } = render(
      <PublicProfileView profile={makeProfile({ theme: 'dark' })} links={[]} />
    );
    expect(root(container).classList.contains('theme-dark')).toBe(true);
  });

  it('tema accent: root recebe class theme-accent', () => {
    const { container } = render(
      <PublicProfileView profile={makeProfile({ theme: 'accent' })} links={[]} />
    );
    expect(root(container).classList.contains('theme-accent')).toBe(true);
  });

  it('tema inválido/nulo faz fallback para light (sem classe)', () => {
    const { container } = render(
      <PublicProfileView profile={makeProfile({ theme: 'neon' })} links={[]} />
    );
    const el = root(container);
    expect(el.classList.contains('theme-dark')).toBe(false);
    expect(el.classList.contains('theme-accent')).toBe(false);
  });

  it('renderiza links ativos na ordem, em nova aba com rel seguro', () => {
    render(<PublicProfileView profile={makeProfile()} links={links} />);
    const nav = screen.getByRole('navigation', { name: 'Links' });
    const anchors = within(nav).getAllByRole('link');
    expect(anchors.map((a) => a.textContent)).toEqual(['Primeiro', 'Segundo']);
    for (const a of anchors) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('mostra nome, @username e fallback de iniciais do avatar', () => {
    render(<PublicProfileView profile={makeProfile({ avatar_url: null })} links={[]} />);
    expect(screen.getByRole('heading', { name: 'Alessandro Varela' })).toBeInTheDocument();
    expect(screen.getByText('@alessandro')).toBeInTheDocument();
    expect(screen.getByText('AV')).toBeInTheDocument();
  });

  it('sem links mostra estado vazio', () => {
    render(<PublicProfileView profile={makeProfile()} links={[]} />);
    expect(screen.getByText('Nenhum link por aqui ainda.')).toBeInTheDocument();
  });
});
