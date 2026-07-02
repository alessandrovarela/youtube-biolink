// Geometria pura para o gráfico de linha inline-SVG do dashboard de analytics
// (Story 5.5). Zero dependência: a série diária (`DailyClickPoint[]` da Story 5.4)
// vira coordenadas SVG num viewBox fixo, e a UI apenas desenha. Isolar a matemática
// aqui a torna testável sem renderizar componente (AC8). Segue o guia `dataviz`:
// série única (sem legenda, o título nomeia o dado), marca fina, grid recessivo.
import type { DailyClickPoint } from '@/lib/analytics/clicks';

/** Um ponto da série projetado no espaço do SVG (coordenadas do viewBox). */
export interface ChartPoint {
  x: number;
  y: number;
  day: string;
  clicks: number;
}

/** Tick do eixo Y: valor "limpo" + posição vertical no viewBox. */
export interface ChartYTick {
  value: number;
  y: number;
}

/** Geometria completa do gráfico, pronta para virar atributos SVG. */
export interface ChartGeometry {
  width: number;
  height: number;
  /** Retângulo da área de plotagem (dentro das margens dos eixos). */
  plot: { left: number; top: number; right: number; bottom: number };
  /** Base (y do valor 0) — onde a área fecha e a coluna nasce. */
  baseline: number;
  points: ChartPoint[];
  /** `"x,y x,y …"` para `<polyline points>`. Vazio se não há pontos. */
  linePoints: string;
  /** Path da área sob a linha (`M … L … Z`). Vazio se não há pontos. */
  areaPath: string;
  maxClicks: number;
  yTicks: ChartYTick[];
}

export interface ChartOptions {
  width?: number;
  height?: number;
  /** Margens para acomodar rótulos dos eixos. */
  padLeft?: number;
  padRight?: number;
  padTop?: number;
  padBottom?: number;
}

const DEFAULTS = {
  width: 720,
  height: 240,
  padLeft: 40,
  padRight: 14,
  padTop: 14,
  padBottom: 26,
} as const;

/** Arredonda para 2 casas — evita coordenadas com dízimas longas no SVG. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ticks "limpos" do eixo Y: [0], [0,max] ou [0,mid,max]. */
export function yTickValues(max: number): number[] {
  if (max <= 0) return [0];
  const mid = Math.round(max / 2);
  return mid > 0 && mid < max ? [0, mid, max] : [0, max];
}

/**
 * Projeta a série diária em coordenadas SVG. Puro e determinístico.
 * Casos-limite tratados: série vazia (sem pontos), ponto único (centralizado no X)
 * e máximo 0 (todos os pontos na baseline, sem divisão por zero).
 */
export function buildLineChart(
  series: DailyClickPoint[],
  options: ChartOptions = {}
): ChartGeometry {
  const width = options.width ?? DEFAULTS.width;
  const height = options.height ?? DEFAULTS.height;
  const padLeft = options.padLeft ?? DEFAULTS.padLeft;
  const padRight = options.padRight ?? DEFAULTS.padRight;
  const padTop = options.padTop ?? DEFAULTS.padTop;
  const padBottom = options.padBottom ?? DEFAULTS.padBottom;

  const plot = {
    left: padLeft,
    top: padTop,
    right: width - padRight,
    bottom: height - padBottom,
  };
  const plotW = plot.right - plot.left;
  const plotH = plot.bottom - plot.top;
  const baseline = plot.bottom;

  const maxClicks = series.reduce((m, p) => (p.clicks > m ? p.clicks : m), 0);
  const n = series.length;

  const points: ChartPoint[] = series.map((p, i) => {
    const x = n > 1 ? plot.left + (i / (n - 1)) * plotW : plot.left + plotW / 2;
    const y = maxClicks > 0 ? plot.bottom - (p.clicks / maxClicks) * plotH : baseline;
    return { x: round2(x), y: round2(y), day: p.day, clicks: p.clicks };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  let areaPath = '';
  if (points.length > 0) {
    const first = points[0];
    const last = points[points.length - 1];
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    areaPath = `${line} L${last.x},${baseline} L${first.x},${baseline} Z`;
  }

  const yTicks: ChartYTick[] = yTickValues(maxClicks).map((value) => ({
    value,
    y: round2(maxClicks > 0 ? plot.bottom - (value / maxClicks) * plotH : baseline),
  }));

  return {
    width,
    height,
    plot,
    baseline,
    points,
    linePoints,
    areaPath,
    maxClicks,
    yTicks,
  };
}

/** 'YYYY-MM-DD' → 'DD/MM' (rótulo curto de eixo, pt-BR). Puro, sem timezone. */
export function formatDayShort(day: string): string {
  const [, month, date] = day.split('-');
  return `${date}/${month}`;
}

/** Formata contagem inteira em pt-BR (separador de milhar). */
export function formatCount(n: number): string {
  return n.toLocaleString('pt-BR');
}
