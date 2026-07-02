import { buildLineChart, formatCount, formatDayShort, yTickValues } from '@/lib/analytics/chart';
import { parsePeriod } from '@/components/dashboard/analytics/period-toggle';
import type { DailyClickPoint } from '@/lib/analytics/clicks';

const series = (clicks: number[]): DailyClickPoint[] =>
  clicks.map((c, i) => ({ day: `2026-06-${String(i + 1).padStart(2, '0')}`, clicks: c }));

describe('buildLineChart', () => {
  it('mapeia o maior valor para a base do plot (topo) e 0 para a baseline', () => {
    const geo = buildLineChart(series([0, 10]));
    expect(geo.maxClicks).toBe(10);
    // 2 pontos: primeiro à esquerda, último à direita do plot.
    expect(geo.points[0].x).toBe(geo.plot.left);
    expect(geo.points[1].x).toBe(geo.plot.right);
    // clicks=0 fica na baseline; clicks=max (10) fica no topo do plot.
    expect(geo.points[0].y).toBe(geo.baseline);
    expect(geo.points[1].y).toBe(geo.plot.top);
  });

  it('distribui X uniformemente para N pontos', () => {
    const geo = buildLineChart(series([1, 2, 3]));
    const mid = (geo.plot.left + geo.plot.right) / 2;
    expect(geo.points[1].x).toBeCloseTo(mid, 5);
  });

  it('centraliza o X quando há um único ponto', () => {
    const geo = buildLineChart(series([5]));
    const mid = (geo.plot.left + geo.plot.right) / 2;
    expect(geo.points[0].x).toBeCloseTo(mid, 5);
  });

  it('sem divisão por zero quando todos os cliques são 0 (todos na baseline)', () => {
    const geo = buildLineChart(series([0, 0, 0]));
    expect(geo.maxClicks).toBe(0);
    expect(geo.points.every((p) => p.y === geo.baseline)).toBe(true);
    expect(geo.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it('série vazia → sem pontos e paths vazios', () => {
    const geo = buildLineChart([]);
    expect(geo.points).toHaveLength(0);
    expect(geo.linePoints).toBe('');
    expect(geo.areaPath).toBe('');
  });

  it('linePoints tem um par x,y por ponto e areaPath fecha na baseline', () => {
    const geo = buildLineChart(series([1, 4, 2]));
    expect(geo.linePoints.split(' ')).toHaveLength(3);
    expect(geo.areaPath.startsWith('M')).toBe(true);
    expect(geo.areaPath.endsWith('Z')).toBe(true);
    expect(geo.areaPath).toContain(`,${geo.baseline}`);
  });
});

describe('yTickValues', () => {
  it('retorna [0] quando max é 0', () => {
    expect(yTickValues(0)).toEqual([0]);
  });
  it('inclui 0, meio e max', () => {
    expect(yTickValues(10)).toEqual([0, 5, 10]);
  });
  it('colapsa o meio quando max é 1', () => {
    expect(yTickValues(1)).toEqual([0, 1]);
  });
});

describe('formatDayShort', () => {
  it("'YYYY-MM-DD' → 'DD/MM'", () => {
    expect(formatDayShort('2026-07-01')).toBe('01/07');
    expect(formatDayShort('2026-12-25')).toBe('25/12');
  });
});

describe('formatCount', () => {
  it('usa separador de milhar pt-BR', () => {
    expect(formatCount(1234)).toBe('1.234');
    expect(formatCount(0)).toBe('0');
  });
});

describe('parsePeriod', () => {
  it('aceita períodos válidos', () => {
    expect(parsePeriod('7')).toBe(7);
    expect(parsePeriod('30')).toBe(30);
    expect(parsePeriod('90')).toBe(90);
  });
  it('cai no default (30) para valores inválidos/ausentes', () => {
    expect(parsePeriod(undefined)).toBe(30);
    expect(parsePeriod('abc')).toBe(30);
    expect(parsePeriod('15')).toBe(30);
    expect(parsePeriod('')).toBe(30);
  });
});
