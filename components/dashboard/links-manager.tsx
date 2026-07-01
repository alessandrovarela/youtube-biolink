'use client';

// Story 3.3 — Gestor de links (client). Form inline de criação + lista com
// edição inline, toggle is_active e deleção com confirmação inline (sem
// window.confirm, que bloqueia). Feedback inline; optimistic em criar e toggle.
import { useState, useTransition, type FormEvent } from 'react';
import { createLink, updateLink, deleteLink, toggleLinkActive } from '@/lib/actions/links';
import type { Link } from '@/lib/types';

const MAX_LINKS = 30;

export function LinksManager({ initialLinks }: { initialLinks: Link[] }) {
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const atLimit = links.length >= MAX_LINKS;

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await createLink({ title, url });
      if (res.ok && res.data) {
        const created = res.data;
        setLinks((prev) => [...prev, created]);
        setTitle('');
        setUrl('');
        setSuccess('Link criado!');
      } else if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.fieldErrors ? null : res.error);
      }
    });
  }

  function replaceLink(updated: Link) {
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700">Adicionar link</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-title" className="text-sm font-medium">
            Título
          </label>
          <input
            id="new-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            aria-invalid={errors.title ? true : undefined}
            className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />
          {errors.title && (
            <span role="alert" className="text-sm text-red-600">
              {errors.title}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-url" className="text-sm font-medium">
            URL
          </label>
          <input
            id="new-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemplo.com"
            aria-invalid={errors.url ? true : undefined}
            className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />
          {errors.url && (
            <span role="alert" className="text-sm text-red-600">
              {errors.url}
            </span>
          )}
        </div>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        {success && <p className="text-sm text-green-700">{success}</p>}
        {atLimit && (
          <p className="text-sm text-amber-700">
            Você atingiu o limite de {MAX_LINKS} links.
          </p>
        )}
        <button
          type="submit"
          disabled={pending || atLimit}
          className="self-start rounded bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>

      {links.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum link ainda. Adicione o primeiro acima.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {links.map((link) => (
            <li key={link.id}>
              <LinkItem link={link} onChange={replaceLink} onRemove={removeLink} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkItem({
  link,
  onChange,
  onRemove,
}: {
  link: Link;
  onChange: (updated: Link) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function startEdit() {
    setTitle(link.title);
    setUrl(link.url);
    setErrors({});
    setMessage(null);
    setEditing(true);
  }

  function save() {
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const res = await updateLink({ id: link.id, title, url });
      if (res.ok && res.data) {
        onChange(res.data);
        setEditing(false);
      } else if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) setMessage(res.error);
      }
    });
  }

  function toggle() {
    const previous = link.is_active;
    const next = !previous;
    setMessage(null);
    onChange({ ...link, is_active: next }); // optimistic
    startTransition(async () => {
      const res = await toggleLinkActive({ id: link.id, is_active: next });
      if (res.ok && res.data) {
        onChange(res.data);
      } else if (!res.ok) {
        onChange({ ...link, is_active: previous }); // rollback
        setMessage(res.error);
      }
    });
  }

  function remove() {
    setMessage(null);
    startTransition(async () => {
      const res = await deleteLink({ id: link.id });
      if (res.ok) {
        onRemove(link.id);
      } else {
        setConfirming(false);
        setMessage(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-gray-200 p-3">
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            aria-label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            aria-invalid={errors.title ? true : undefined}
            className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />
          {errors.title && (
            <span role="alert" className="text-sm text-red-600">
              {errors.title}
            </span>
          )}
          <input
            aria-label="URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={errors.url ? true : undefined}
            className="rounded border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />
          {errors.url && (
            <span role="alert" className="text-sm text-red-600">
              {errors.url}
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`truncate font-medium ${link.is_active ? '' : 'text-gray-400'}`}>
              {link.title}
            </p>
            <p className="truncate text-sm text-gray-500">{link.url}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              disabled={pending}
              aria-pressed={link.is_active}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-60"
            >
              {link.is_active ? 'Ativo' : 'Inativo'}
            </button>
            <button
              type="button"
              onClick={startEdit}
              disabled={pending}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-60"
            >
              Editar
            </button>
            {confirming ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-60"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={pending}
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-60"
              >
                Deletar
              </button>
            )}
          </div>
        </div>
      )}
      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}
