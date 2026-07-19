'use server';

// Story 5.2 — Server Action de tracking de clique (analytics, Epic 5).
// Convenção § 5.1: 'use server', validação inline, retorna ActionResult, NUNCA lança.
//
// Diferença das actions de links (Story 3.3): aqui o clicador é um VISITANTE
// ANÔNIMO da página pública `/[username]`, sem sessão. Por isso usamos
// createPublicClient() (stateless, sem cookies) — o MESMO client da leitura
// pública (Story 3.5), e não createServerClient() (que exige cookies de sessão).
//
// Story 6.3 — a escrita passa a ser feita pela RPC `record_link_click`:
//   `link_clicks` agora tem RLS habilitada e NENHUMA policy de INSERT, ou seja, o
//   INSERT direto com a anon key é NEGADO pelo banco (era o concern MEDIUM do gate do
//   Epic 5: a anon key é pública, então qualquer um podia POSTar cliques falsos).
//   A única porta de escrita é a função SECURITY DEFINER `record_link_click`, que
//   valida `is_active` DENTRO do banco, atômico com o INSERT.
//   Ganhos: (1) o SELECT prévio de `links` some daqui — 2 round-trips viram 1;
//           (2) acaba a janela TOCTOU entre "conferi que está ativo" e "inseri";
//           (3) NENHUM client novo e NENHUM env novo — nada de service role no runtime
//               (o admin client foi explicitamente REFUTADO pelo ADR-001).
//   [Source: docs/architecture/security-epic-6.md — ADR-001 § 2]
//
// Privacidade: grava apenas o user-agent truncado (<=120), SEM IP raw; a RPC trunca
// de novo no banco (defesa em camadas). `user_agent_hash` fica null (stretch, não
// obrigatório). Rate limiting / click inflation: Story 6.4 — ainda em aberto aqui.
// [Source: architecture.md § 5.1; docs/architecture/ER.md — Epic 5; PRD Story 5.2]

import { headers } from 'next/headers';
import { createPublicClient } from '@/lib/supabase';
import type { ActionResult } from './types';

/** Máximo gravado em user_agent_short — paridade com o CHECK do banco (Story 5.1). */
const UA_MAX = 120;

/** UUID v1–v5 (case-insensitive). Valida linkId antes de qualquer ida ao banco. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GENERIC_ERROR = 'Não foi possível registrar o clique.';

/**
 * Registra um clique em um link ativo. Chamada a partir da página pública por um
 * visitante anônimo. Valida que `linkId` é um UUID no app e delega ao banco a
 * validação autoritativa de existência + `is_active` (RPC `record_link_click`,
 * atômica com o INSERT) — evita lixo na tabela append-only sem janela TOCTOU.
 *
 * NUNCA lança: qualquer falha (input inválido, link inexistente/inativo, erro de
 * banco ou de contexto) vira um ActionResult de erro — um clique não deve quebrar
 * a navegação do visitante. [Source: PRD Story 5.2 AC2, AC6; ADR-001 § 2]
 */
export async function trackLinkClick(linkId: string): Promise<ActionResult> {
  try {
    const id = (linkId ?? '').trim();
    if (!UUID_RE.test(id)) return { ok: false, error: 'Link inválido' };

    // 1) User-agent truncado (<=120), sem IP raw. hash fica null (stretch).
    const h = await headers();
    const ua = h.get('user-agent');
    const userAgentShort = ua ? ua.slice(0, UA_MAX) : null;

    // 2) Escrita pela ÚNICA porta aberta: a RPC valida is_active no banco e insere na
    //    MESMA transação. `false` = link inexistente ou inativo (no-op silencioso).
    //    createPublicClient() (anon key, stateless) preserva o ISR da página pública.
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc('record_link_click', {
      p_link_id: id,
      p_user_agent_short: userAgentShort,
    });
    if (error) return { ok: false, error: GENERIC_ERROR };
    if (data !== true) return { ok: false, error: 'Link não encontrado ou inativo' };

    return { ok: true };
  } catch {
    // Guarda de último recurso: tracking nunca propaga exceção ao client.
    return { ok: false, error: GENERIC_ERROR };
  }
}
