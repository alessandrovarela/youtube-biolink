'use server';

// Story 5.2 — Server Action de tracking de clique (analytics, Epic 5).
// Convenção § 5.1: 'use server', validação inline, retorna ActionResult, NUNCA lança.
//
// Diferença das actions de links (Story 3.3): aqui o clicador é um VISITANTE
// ANÔNIMO da página pública `/[username]`, sem sessão. Por isso usamos
// createPublicClient() (stateless, sem cookies) — o MESMO client da leitura
// pública (Story 3.5), e não createServerClient() (que exige cookies de sessão).
// Sem SERVICE_ROLE: `link_clicks` não tem RLS no MVP (Story 5.1; RLS deferida p/
// Story 6.3), então o INSERT com a anon key funciona diretamente.
//
// Privacidade: grava apenas o user-agent truncado (<=120), SEM IP raw;
// `user_agent_hash` fica null (stretch, não obrigatório). Sem rate limiting (Epic 6).
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
 * visitante anônimo. Valida que `linkId` é um UUID e que o link EXISTE e está
 * `is_active = true` ANTES de inserir (evita lixo na tabela append-only).
 *
 * NUNCA lança: qualquer falha (input inválido, link inexistente/inativo, erro de
 * banco ou de contexto) vira um ActionResult de erro — um clique não deve quebrar
 * a navegação do visitante. [Source: PRD Story 5.2 AC2, AC6]
 */
export async function trackLinkClick(linkId: string): Promise<ActionResult> {
  try {
    const id = (linkId ?? '').trim();
    if (!UUID_RE.test(id)) return { ok: false, error: 'Link inválido' };

    const supabase = createPublicClient();

    // 1) O link precisa existir e estar ativo — caso contrário, não registra.
    const { data: link, error: linkErr } = await supabase
      .from('links')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle();
    if (linkErr) return { ok: false, error: GENERIC_ERROR };
    if (!link) return { ok: false, error: 'Link não encontrado' };
    if (!link.is_active) return { ok: false, error: 'Link inativo' };

    // 2) User-agent truncado (<=120), sem IP raw. hash fica null (stretch).
    const h = await headers();
    const ua = h.get('user-agent');
    const userAgentShort = ua ? ua.slice(0, UA_MAX) : null;

    // 3) INSERT append-only via client público (anon, stateless): sem RLS no MVP.
    const { error: insErr } = await supabase
      .from('link_clicks')
      .insert({ link_id: id, user_agent_short: userAgentShort });
    if (insErr) return { ok: false, error: GENERIC_ERROR };

    return { ok: true };
  } catch {
    // Guarda de último recurso: tracking nunca propaga exceção ao client.
    return { ok: false, error: GENERIC_ERROR };
  }
}
