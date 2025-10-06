'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import { ColumnDef } from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function ColumnManagerModal<TData>({
  open,
  onClose,
  onSave,
  allColumns,
  order,
  setOrder,
  visibility,
  setVisibility,
  storageKey,
  layoutKeyV2,
}: {
  open: boolean;
  onClose: () => void;
  onSave?: (payload: { order: string[]; visibility: Record<string, boolean> }) => void;
  allColumns: ColumnDef<TData, any>[];
  order: string[];
  setOrder: (next: string[]) => void;
  visibility: Record<string, boolean>;
  setVisibility: (next: Record<string, boolean>) => void;
  storageKey: string;
  layoutKeyV2?: string;
}) {
  const t = useT();
  // Hooks must not be called conditionally; set up sensors before any early return
  const sensors = useSensors(useSensor(PointerSensor));
  const ids = order.length
    ? order
    : allColumns.map((c: any) => c.id || c.accessorKey).filter(Boolean);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over?.id));
      if (oldIndex >= 0 && newIndex >= 0) {
        const next = arrayMove(ids, oldIndex, newIndex);
        setOrder(next);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{t('table.columns')}</CardTitle>
          <CardDescription>
            {t('table.columns_desc') || 'Drag to reorder, toggle to show/hide'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {ids.map((id) => {
                  const def: any = allColumns.find((c: any) => (c.id || c.accessorKey) === id);
                  if (!def) return null;
                  const canHide = def?.enableHiding !== false;
                  const headerDef = def.header as any;
                  const label = typeof headerDef === 'string' ? headerDef : id;
                  // Non-hideable columns must always be visible and checkbox stays checked/disabled
                  const baseVisible = visibility[id] ?? true;
                  const visible = canHide ? baseVisible : true;
                  return (
                    <SortableItem id={id} key={id}>
                      <div className="bg-background flex items-center justify-between gap-3 rounded border px-2 py-1">
                        <div className="flex items-center gap-2">
                          <input
                            id={`col-${id}`}
                            type="checkbox"
                            checked={visible}
                            disabled={!canHide}
                            onChange={(e) => {
                              if (!canHide) return;
                              const next: Record<string, boolean> = {
                                ...visibility,
                                [id]: e.target.checked,
                              };
                              setVisibility(next);
                              try {
                                localStorage.setItem(
                                  storageKey,
                                  JSON.stringify({ order: ids, visibility: next }),
                                );
                                if (layoutKeyV2) {
                                  const layout: Record<
                                    string,
                                    { order: number; visible: boolean }
                                  > = {};
                                  ids.forEach((colId, idx) => {
                                    const defAny: any = allColumns.find(
                                      (c: any) => (c.id || c.accessorKey) === colId,
                                    );
                                    const alwaysOn = defAny?.enableHiding === false;
                                    layout[colId] = {
                                      order: idx,
                                      visible: alwaysOn ? true : next[colId] !== false,
                                    };
                                  });
                                  localStorage.setItem(layoutKeyV2, JSON.stringify(layout));
                                }
                              } catch {}
                            }}
                          />
                          <label htmlFor={`col-${id}`} className="text-sm">
                            {label}
                          </label>
                        </div>
                        <div className="text-muted-foreground text-xs">drag</div>
                      </div>
                    </SortableItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOrder([]);
                setVisibility({});
                localStorage.removeItem(storageKey);
                if (layoutKeyV2) localStorage.removeItem(layoutKeyV2);
                onClose();
              }}
            >
              {t('common.reset') || 'Reset'}
            </Button>
            <Button
              onClick={() => {
                const orderToSave = ids;
                const enforced: Record<string, boolean> = { ...visibility };
                for (const id of orderToSave) {
                  const def: any = allColumns.find((c: any) => (c.id || c.accessorKey) === id);
                  if (def?.enableHiding === false) enforced[id] = true;
                }
                // Reflect saved state back to parent so UI updates immediately
                setOrder(orderToSave);
                setVisibility(enforced);
                localStorage.setItem(
                  storageKey,
                  JSON.stringify({ order: orderToSave, visibility: enforced }),
                );
                if (layoutKeyV2) {
                  const layout: Record<string, { order: number; visible: boolean }> = {};
                  orderToSave.forEach((colId, idx) => {
                    const defAny: any = allColumns.find(
                      (c: any) => (c.id || c.accessorKey) === colId,
                    );
                    const alwaysOn = defAny?.enableHiding === false;
                    layout[colId] = {
                      order: idx,
                      visible: alwaysOn ? true : enforced[colId] !== false,
                    };
                  });
                  localStorage.setItem(layoutKeyV2, JSON.stringify(layout));
                }
                onSave?.({ order: orderToSave, visibility: enforced });
                onClose();
              }}
            >
              {t('common.save') || 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
