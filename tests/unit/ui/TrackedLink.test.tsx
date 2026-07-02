// Story 5.3 — tracking de clique na página pública.
// Foco: o <a> permanece um link REAL (href/target/rel), clicar dispara
// trackLinkClick com o linkId correto, e uma action que rejeita NÃO quebra
// nem lança na navegação (fire-and-forget best-effort).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackedLink } from '@/components/public/TrackedLink';
import type { PublicLink } from '@/lib/queries/public-page';

// Mock da Server Action — isolamos o componente do banco/rede.
const trackLinkClick = vi.fn<(linkId: string) => Promise<{ ok: boolean; error?: string }>>();
vi.mock('@/lib/actions/track-click', () => ({
  trackLinkClick: (linkId: string) => trackLinkClick(linkId),
}));

const link: PublicLink = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Meu canal',
  url: 'https://youtube.com/@canal',
  position: 0,
};

beforeEach(() => {
  trackLinkClick.mockReset();
  trackLinkClick.mockResolvedValue({ ok: true });
});

describe('TrackedLink — tracking de clique (Story 5.3)', () => {
  it('mantém href, target=_blank e rel=noopener noreferrer', () => {
    render(<TrackedLink link={link} />);
    const a = screen.getByRole('link', { name: 'Meu canal' });
    expect(a).toHaveAttribute('href', 'https://youtube.com/@canal');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('clicar dispara trackLinkClick com o linkId correto', async () => {
    const user = userEvent.setup();
    render(<TrackedLink link={link} />);
    await user.click(screen.getByRole('link', { name: 'Meu canal' }));
    expect(trackLinkClick).toHaveBeenCalledTimes(1);
    expect(trackLinkClick).toHaveBeenCalledWith(link.id);
  });

  it('NÃO usa preventDefault (comportamento nativo do link preservado)', async () => {
    const user = userEvent.setup();
    render(<TrackedLink link={link} />);
    const a = screen.getByRole('link', { name: 'Meu canal' });
    // Interceptamos o evento de clique que borbulha para checar defaultPrevented.
    let prevented = true;
    a.ownerDocument.addEventListener(
      'click',
      (e) => {
        prevented = e.defaultPrevented;
      },
      { once: true }
    );
    await user.click(a);
    expect(prevented).toBe(false);
  });

  it('action que REJEITA não lança nem quebra o clique', async () => {
    trackLinkClick.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    render(<TrackedLink link={link} />);
    const a = screen.getByRole('link', { name: 'Meu canal' });
    // Não deve lançar de forma síncrona no clique.
    await expect(user.click(a)).resolves.toBeUndefined();
    expect(trackLinkClick).toHaveBeenCalledWith(link.id);
  });
});
