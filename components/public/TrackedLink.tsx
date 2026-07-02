'use client';

// Story 5.3 — Link da página pública com tracking de clique (analytics, Epic 5).
//
// ÚNICO componente client da página pública: envolve cada link num <a href> REAL
// e dispara `trackLinkClick(linkId)` no clique, ANTES de o navegador seguir o
// href. Como o link abre em nova aba (target="_blank"), a página pública
// permanece montada e o disparo fire-and-forget completa naturalmente.
//
// Regras (PRD Story 5.3):
//  - fire-and-forget: NÃO aguardamos o resultado (nada de await bloqueante) e
//    ignoramos o retorno — o clique nunca deve segurar a navegação.
//  - NUNCA quebra a navegação: try/catch de último recurso + `.catch` na Promise;
//    a própria action já nunca lança (Story 5.2), isto é defesa em profundidade.
//  - Acessibilidade preservada: continua um <a href> nativo. NÃO usamos
//    preventDefault nem navegação programática — assim Ctrl/Cmd+Click, middle-click
//    e Enter por teclado seguem o comportamento nativo do browser. Só disparamos
//    o tracking em onClick (inclui Enter/left-click) e onAuxClick (middle-click).
//  - Markup/visual idênticos ao Epic 4 (mesmas classes/tokens da PublicProfileView).
import { trackLinkClick } from '@/lib/actions/track-click';
import type { PublicLink } from '@/lib/queries/public-page';

/** Seta de "link externo" (mesmo glifo do ui_kit public-profile / Epic 4). */
function LinkArrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-muted-fg"
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

export interface TrackedLinkProps {
  link: PublicLink;
}

export function TrackedLink({ link }: TrackedLinkProps) {
  // Fire-and-forget: dispara e esquece. Envolvido em try/catch + .catch para
  // garantir que NENHUMA falha (offline, erro de rede/action) atrapalhe o clique.
  function fireTracking() {
    try {
      void trackLinkClick(link.id).catch(() => {
        /* tracking é best-effort: falha silenciosa, navegação segue */
      });
    } catch {
      /* nunca propaga: um clique jamais deve quebrar a navegação */
    }
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={fireTracking}
      onAuxClick={fireTracking}
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-[18px] py-[14px] font-medium text-fg shadow-[var(--shadow-sm)] transition-[transform,box-shadow,background] duration-150 ease-[var(--ease-out)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:scale-[0.99]"
    >
      <span className="text-[15px]">{link.title}</span>
      <LinkArrow />
    </a>
  );
}
