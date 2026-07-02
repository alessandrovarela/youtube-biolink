import { render, screen, within } from '@testing-library/react';
import { ClicksTable } from '@/components/dashboard/analytics/clicks-table';
import { ClicksChart } from '@/components/dashboard/analytics/clicks-chart';
import { AnalyticsEmptyState } from '@/components/dashboard/analytics/empty-state';
import type { DailyClickPoint, LinkClickTotals } from '@/lib/analytics/clicks';

describe('ClicksTable', () => {
  const rows: LinkClickTotals[] = [
    { link_id: 'a', title: 'Meu YouTube', total: 1200, last7: 30, last30: 200 },
    { link_id: 'b', title: 'Sem cliques', total: 0, last7: 0, last30: 0 },
  ];

  it('lista os links com total, 7d e 30d (incluindo zeros)', () => {
    render(<ClicksTable rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Meu YouTube')).toBeInTheDocument();
    expect(within(table).getByText('Sem cliques')).toBeInTheDocument();
    expect(within(table).getByText('1.200')).toBeInTheDocument();
  });

  it('tem <caption> para acessibilidade', () => {
    render(<ClicksTable rows={rows} />);
    expect(screen.getByRole('table').querySelector('caption')).not.toBeNull();
  });
});

describe('ClicksChart', () => {
  const series: DailyClickPoint[] = [
    { day: '2026-06-01', clicks: 2 },
    { day: '2026-06-02', clicks: 5 },
    { day: '2026-06-03', clicks: 1 },
  ];

  it('expõe o SVG como imagem com aria-label descritivo', () => {
    render(<ClicksChart series={series} days={7} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/últimos 7 dias/);
    expect(img.getAttribute('aria-label')).toMatch(/8/); // total = 2+5+1
  });

  it('fornece tabela alternativa (sr-only) com os dados diários', () => {
    render(<ClicksChart series={series} days={7} />);
    // A tabela alternativa carrega os dias exatos da série.
    expect(screen.getByText('2026-06-02')).toBeInTheDocument();
    expect(screen.getByRole('table').querySelector('caption')).not.toBeNull();
  });
});

describe('AnalyticsEmptyState', () => {
  it('mostra cópia amigável e CTA para a página pública', () => {
    render(<AnalyticsEmptyState username="alevarela" />);
    expect(screen.getByText(/Nenhum clique ainda/)).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /@alevarela/ });
    expect(cta).toHaveAttribute('href', '/alevarela');
  });

  it('omite o CTA quando não há username', () => {
    render(<AnalyticsEmptyState username={null} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
