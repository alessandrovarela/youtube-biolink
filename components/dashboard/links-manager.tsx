'use client';

// Story 3.3 — Gestor de links (client). Form inline de criação + lista com
// edição inline, toggle is_active e deleção com confirmação inline (sem
// window.confirm, que bloqueia). Feedback inline; optimistic em criar e toggle.
// Story 3.4 — reordenação via drag-and-drop (@dnd-kit) + alternativa por
// teclado (botões ↑/↓); optimistic + persistência via reorderLinks (update em
// lote de position). [Source: architecture.md § 3.1, § 5.2]
// Story 4.2 — migrado para os primitivos do design system (Card/Input/Button/Toast).
import { useState, useTransition, type FormEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createLink,
  updateLink,
  deleteLink,
  toggleLinkActive,
  reorderLinks,
} from '@/lib/actions/links';
import type { Link } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

const MAX_LINKS = 30;

export function LinksManager({ initialLinks }: { initialLinks: Link[] }) {
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [, startReorder] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const atLimit = links.length >= MAX_LINKS;

  /** Aplica a nova ordem (optimistic) e persiste via reorderLinks; reconcilia no erro. */
  function persistOrder(next: Link[], previous: Link[]) {
    setReorderError(null);
    setLinks(next);
    startReorder(async () => {
      const res = await reorderLinks({ ids: next.map((l) => l.id) });
      if (!res.ok) {
        setLinks(previous); // rollback: mantém a ordem persistida no servidor
        setReorderError(res.error);
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = links.findIndex((l) => l.id === active.id);
    const newIndex = links.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persistOrder(arrayMove(links, oldIndex, newIndex), links);
  }

  /** Alternativa por teclado: move o item uma posição e refoca o botão correto. */
  function moveLink(id: string, direction: -1 | 1) {
    const index = links.findIndex((l) => l.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= links.length) return;
    persistOrder(arrayMove(links, index, target), links);

    // Foco: mantém a mesma direção se ainda houver movimento possível; senão,
    // inverte (o botão original ficará desabilitado no topo/fim da lista).
    const canKeepDir = direction === -1 ? target > 0 : target < links.length - 1;
    const focusDir = canKeepDir ? direction : ((direction * -1) as -1 | 1);
    requestAnimationFrame(() => {
      document.getElementById(`move-${focusDir === -1 ? 'up' : 'down'}-${id}`)?.focus();
    });
  }

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
      <Card>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-fg">Adicionar link</h2>
          <Input
            label="Título"
            id="new-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            error={errors.title}
          />
          <Input
            label="URL"
            id="new-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemplo.com"
            error={errors.url}
          />
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          {atLimit && (
            <p className="text-sm text-warning">Você atingiu o limite de {MAX_LINKS} links.</p>
          )}
          <Button type="submit" loading={pending} disabled={atLimit} className="self-start">
            Adicionar
          </Button>
        </form>
      </Card>

      {reorderError && (
        <p role="alert" className="text-sm text-danger">
          {reorderError}
        </p>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-muted-fg">Nenhum link ainda. Adicione o primeiro acima.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-3">
              {links.map((link, index) => (
                <SortableLinkItem
                  key={link.id}
                  link={link}
                  index={index}
                  count={links.length}
                  onChange={replaceLink}
                  onRemove={removeLink}
                  onMove={moveLink}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {success && <Toast message={success} variant="success" onDismiss={() => setSuccess(null)} />}
    </div>
  );
}

// Linha sortável: envolve o LinkItem com o handle de drag (@dnd-kit) e a
// alternativa por teclado (↑/↓). O card (borda/padding) vive aqui; o LinkItem
// renderiza apenas o conteúdo. [Source: prd.md Story 3.4 AC1/AC3]
function SortableLinkItem({
  link,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  link: Link;
  index: number;
  count: number;
  onChange: (updated: Link) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const iconBtn =
    'rounded-md text-muted-fg transition-colors hover:bg-muted hover:text-fg disabled:opacity-40';

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-stretch gap-2 rounded-lg border border-border bg-surface p-3"
    >
      <div className="flex shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastar para reordenar ${link.title}`}
          className={cn('cursor-grab touch-none px-1 active:cursor-grabbing', iconBtn)}
        >
          ⠿
        </button>
        <button
          id={`move-up-${link.id}`}
          type="button"
          onClick={() => onMove(link.id, -1)}
          disabled={index === 0}
          aria-label={`Mover ${link.title} para cima`}
          className={cn('border border-border px-1 text-xs leading-none', iconBtn)}
        >
          ↑
        </button>
        <button
          id={`move-down-${link.id}`}
          type="button"
          onClick={() => onMove(link.id, 1)}
          disabled={index === count - 1}
          aria-label={`Mover ${link.title} para baixo`}
          className={cn('border border-border px-1 text-xs leading-none', iconBtn)}
        >
          ↓
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <LinkItem link={link} onChange={onChange} onRemove={onRemove} />
      </div>
    </li>
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
    <div className="flex flex-col gap-2">
      {editing ? (
        <div className="flex flex-col gap-2">
          <Input
            aria-label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            error={errors.title}
          />
          <Input
            aria-label="URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={errors.url}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} loading={pending}>
              Salvar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className={cn('min-w-0', link.is_active ? '' : 'opacity-55')}>
            <p className="truncate font-medium">{link.title}</p>
            <p className="truncate font-mono text-sm text-muted-fg">{link.url}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={link.is_active ? 'secondary' : 'ghost'}
              onClick={toggle}
              disabled={pending}
              aria-pressed={link.is_active}
            >
              {link.is_active ? 'Ativo' : 'Inativo'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={startEdit}
              disabled={pending}
            >
              Editar
            </Button>
            {confirming ? (
              <span className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={remove}
                  loading={pending}
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(true)}
                disabled={pending}
                className="text-danger"
              >
                Deletar
              </Button>
            )}
          </div>
        </div>
      )}
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
