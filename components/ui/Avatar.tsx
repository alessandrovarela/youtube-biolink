// Story 4.2 — Avatar primitivo com fallback de iniciais.
// Derivado de docs/design/system/project/preview/avatars.html.
// Client: precisa reagir a falha de carregamento da imagem (onError → fallback).
'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

export type AvatarProps = {
  src?: string | null;
  /** Nome usado para derivar as iniciais do fallback. */
  displayName?: string | null;
  /** Lado do círculo em px. */
  size?: number;
  alt?: string;
  className?: string;
};

/** Iniciais a partir do nome: 2 letras (primeira + última palavra), maiúsculas. */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ src, displayName, size = 64, alt, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // Reseta o estado de falha quando a fonte muda (ex.: usuário edita a URL).
  // Ajuste de estado durante o render (padrão recomendado pelo React em vez de
  // um effect) — evita re-render em cascata.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setFailed(false);
  }

  const showImage = Boolean(src) && !failed;
  const initials = getInitials(displayName);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-fg',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={alt ?? displayName ?? ''}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-label={displayName ?? undefined}>{initials}</span>
      )}
    </span>
  );
}
