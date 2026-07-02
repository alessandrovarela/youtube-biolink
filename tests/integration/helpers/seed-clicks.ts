// Seed reutilizável de cliques para testes de agregação e benchmark (Story 5.4).
// Faz BULK INSERT (chunked) — nunca 10k round-trips. Usado pelo teste de
// correção (seed pequeno) e pelo benchmark (10k), ambos contra o dev.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClickRow {
  link_id: string;
  clicked_at: string; // ISO 8601
}

/**
 * Insere cliques em massa, em chunks (default 1000), para não estourar limites
 * de payload nem fazer um INSERT por linha. Lança em erro (é código de teste).
 */
export async function bulkInsertClicks(
  client: SupabaseClient,
  rows: ClickRow[],
  chunkSize = 1000
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from('link_clicks').insert(chunk);
    if (error) throw new Error(`bulkInsertClicks falhou (chunk ${i}): ${error.message}`);
  }
}

/**
 * Gera `count` cliques para `linkId` num dia UTC deslocado `dayOffset` de hoje
 * (0 = hoje). Fixa 12:00 UTC para que o date_trunc('day') da view caia no dia
 * pretendido de forma determinística.
 */
export function clicksOnDay(linkId: string, dayOffset: number, count: number): ClickRow[] {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - dayOffset);
  const iso = d.toISOString();
  return Array.from({ length: count }, () => ({ link_id: linkId, clicked_at: iso }));
}

/**
 * Gera `total` cliques para `linkId` espalhados uniformemente pelos últimos
 * `spanDays` dias (round-robin). Usado pelo benchmark (10k cliques / N dias).
 */
export function clicksSpread(linkId: string, total: number, spanDays: number): ClickRow[] {
  const rows: ClickRow[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - (i % spanDays));
    rows.push({ link_id: linkId, clicked_at: d.toISOString() });
  }
  return rows;
}
