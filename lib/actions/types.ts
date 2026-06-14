// Tipo de retorno padrão das Server Actions (architecture.md § 5.1).
// Actions nunca lançam — sempre retornam ActionResult.
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type FormState<T = void> = ActionResult<T> | null;
