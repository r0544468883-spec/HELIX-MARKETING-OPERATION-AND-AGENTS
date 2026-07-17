'use client';

// Drag-and-drop request queue. dnd-kit logic adapted from nextcrm's Kanban.tsx,
// rendered with helix-ops Tailwind tokens (no shadcn) over fixed status columns.

import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { updateRequestStatus } from '@/app/actions-ops';

export type Req = {
  id: string;
  title: string;
  brief: string | null;
  channels: string[];
  due_date: string | null;
  priority: string;
  status: string;
};

const COLUMNS: { key: string; label: string }[] = [
  { key: 'new', label: 'חדש' },
  { key: 'in_progress', label: 'בעבודה' },
  { key: 'review', label: 'לאישור' },
  { key: 'approved', label: 'מאושר' },
  { key: 'done', label: 'הושלם' },
];

const PRIORITY: Record<string, { label: string; cls: string }> = {
  urgent: { label: 'דחופה', cls: 'text-red-400' },
  high: { label: 'גבוהה', cls: 'text-orange-400' },
  normal: { label: 'רגילה', cls: 'text-yellow-400' },
  low: { label: 'נמוכה', cls: 'text-green-400' },
};

function Card({ req, locale }: { req: Req; locale: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: req.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const pr = PRIORITY[req.priority] ?? { label: req.priority, cls: 'text-ink-muted' };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-surface border border-border rounded-[10px] p-3 mb-2 cursor-grab active:cursor-grabbing hover:border-border-strong hover:shadow-lg transition-all"
    >
      <div className="font-semibold text-[14px] mb-1" dir="auto">
        {req.title}
      </div>
      {req.brief && (
        <p className="text-[13px] text-ink-secondary line-clamp-2 mb-2" dir="auto">
          {req.brief}
        </p>
      )}
      <div className="flex items-center justify-between text-[12px]">
        <span className={pr.cls}>{pr.label}</span>
        {req.due_date && (
          <span className="text-ink-muted" dir="ltr">
            {new Date(req.due_date).toLocaleDateString('he-IL')}
          </span>
        )}
      </div>
      {req.channels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {req.channels.map((c) => (
            <span
              key={c}
              className="text-[11px] bg-bg border border-border rounded-full px-2 py-0.5 text-ink-secondary"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/${locale}/requests/${req.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-block mt-2 text-[12px] text-brand hover:underline"
      >
        פתח ↗
      </Link>
    </div>
  );
}

function Column({
  colKey,
  label,
  items,
  locale,
}: {
  colKey: string;
  label: string;
  items: Req[];
  locale: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  return (
    <div className="w-72 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-bold text-[14px]">{label}</h3>
        <span className="text-[12px] text-ink-muted border border-border rounded-full px-2">
          {items.length}
        </span>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`min-h-[120px] rounded-[12px] p-2 border border-dashed transition-colors ${
            isOver ? 'border-brand bg-surface' : 'border-transparent'
          }`}
        >
          {items.map((r) => (
            <Card key={r.id} req={r} locale={locale} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function RequestBoard({ initial, locale }: { initial: Req[]; locale: string }) {
  const [items, setItems] = useState<Req[]>(initial);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const visible = query.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const byStatus = (status: string) => visible.filter((i) => i.status === status);

  // over.id is either a column key (dropped on empty column area) or a card id.
  const resolveColumn = (overId: string): string | null => {
    if (COLUMNS.some((c) => c.key === overId)) return overId;
    return itemsRef.current.find((i) => i.id === overId)?.status ?? null;
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const id = active.id as string;
    const target = resolveColumn(over.id as string);
    if (!target) return;

    const cur = itemsRef.current.find((i) => i.id === id);
    if (!cur || cur.status === target) return;

    const prev = itemsRef.current;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status: target } : i)));
    const res = await updateRequestStatus(id, target);
    if (res?.error) setItems(prev); // rollback on failure
  }

  const activeReq = items.find((i) => i.id === activeId) ?? null;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש בקשות…"
        aria-label="חיפוש בקשות"
        dir="auto"
        className="w-full sm:w-72 mb-5 bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[14px] outline-none focus:border-brand transition-colors"
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((c) => (
          <Column key={c.key} colKey={c.key} label={c.label} items={byStatus(c.key)} locale={locale} />
        ))}
      </div>
        <DragOverlay>
          {activeReq ? (
            <div className="bg-surface border border-brand rounded-[10px] p-3 shadow-lg text-[14px] font-semibold">
              {activeReq.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
