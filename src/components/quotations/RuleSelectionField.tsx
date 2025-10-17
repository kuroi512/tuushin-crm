'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  QuotationRuleSelection,
  QuotationRuleSelectionState,
  QuotationRuleSnippet,
  RuleSnippetType,
} from '@/types/quotation';
import { fromRuleKey } from './useRuleCatalog';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Textarea } from '@/components/ui/textarea';

type SelectionKey = keyof QuotationRuleSelectionState;

type SelectionItem = QuotationRuleSelection & { cid: string };

type RuleSelectionFieldProps = {
  fieldKey: SelectionKey;
  label: string;
  description?: string;
  selections: QuotationRuleSelection[];
  onChange: (next: QuotationRuleSelection[]) => void;
  snippets: QuotationRuleSnippet[];
  recommendedIds?: string[];
  loading?: boolean;
};

function makeCid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cid_${Math.random().toString(36).slice(2, 10)}`;
}

function augment(items: QuotationRuleSelection[]): SelectionItem[] {
  return items.map((item) => ({ ...item, cid: makeCid() }));
}

function strip(items: SelectionItem[]): QuotationRuleSelection[] {
  return items.map(({ cid: _cid, ...rest }) => rest);
}

function limitToSingle(items: QuotationRuleSelection[]): SelectionItem[] {
  return augment(items).slice(0, 1);
}

type SortableSelectionProps = {
  item: SelectionItem;
  onChangeContent: (value: string) => void;
  onChangeLabel: (value: string) => void;
  onRemove: () => void;
  typeLabels: Record<RuleSnippetType, string>;
  defaultHint: string;
};

function SortableSelection({
  item,
  onChangeContent,
  onChangeLabel,
  onRemove,
  typeLabels,
  defaultHint,
}: SortableSelectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.cid,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  const isCustom = item.snippetId === null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-muted/40 text-muted-foreground rounded border p-1"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{item.label}</span>
              <Badge variant="secondary">{typeLabels[item.type] ?? item.type}</Badge>
              {item.incoterm && <Badge variant="outline">{item.incoterm}</Badge>}
              {item.transportMode && <Badge variant="outline">{item.transportMode}</Badge>}
            </div>
            {item.source === 'default' && (
              <div className="text-muted-foreground text-xs">{defaultHint}</div>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove item">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {isCustom && (
        <div className="mt-2">
          <Label className="mb-1 block text-xs font-medium">Custom label</Label>
          <Input
            value={item.label}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeLabel(e.target.value)}
          />
        </div>
      )}
      <div className="mt-2">
        <Label className="mb-1 block text-xs font-medium">Content</Label>
        <Textarea
          value={item.content}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChangeContent(e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );
}

export function RuleSelectionField({
  fieldKey,
  label,
  description,
  selections,
  onChange,
  snippets,
  recommendedIds,
  loading,
}: RuleSelectionFieldProps) {
  const t = useT();
  const typeLabels: Record<RuleSnippetType, string> = {
    INCLUDE: t('quotation.rules.type.include'),
    EXCLUDE: t('quotation.rules.type.exclude'),
    REMARK: t('quotation.rules.type.remark'),
  };
  const customSuffix = t('quotation.rules.customSuffix');
  const defaultHint = t('quotation.rules.defaultHint');
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<SelectionItem[]>(limitToSingle(selections));
  const [search, setSearch] = useState('');
  const skipResetRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setInternal(limitToSingle(selections));
      setSearch('');
    }
  }, [selections, open]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const recommendedSet = useMemo(() => new Set(recommendedIds || []), [recommendedIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return snippets;
    const needle = search.trim().toLowerCase();
    return snippets.filter((snippet) =>
      [snippet.label, snippet.content, snippet.incoterm, snippet.transportMode]
        .filter(Boolean)
        .some((value) => (value || '').toLowerCase().includes(needle)),
    );
  }, [snippets, search]);

  const selectionIds = useMemo(
    () => new Set(internal.map((item) => item.snippetId).filter(Boolean) as string[]),
    [internal],
  );

  const summary = useMemo(() => {
    if (!selections.length) return '';
    return selections
      .map((item) => item.content?.trim() || '')
      .filter(Boolean)
      .join('\n');
  }, [selections]);
  const summaryRows = useMemo(() => {
    if (!summary) return 3;
    const count = summary.split('\n').length;
    return Math.min(Math.max(count, 3), 12);
  }, [summary]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setInternal((items) => {
      const oldIndex = items.findIndex((item) => item.cid === active.id);
      const newIndex = items.findIndex((item) => item.cid === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const toggleSnippet = (snippet: QuotationRuleSnippet) => {
    setInternal((items) => {
      if (items.some((item) => item.snippetId === snippet.id)) {
        return [];
      }
      const next: SelectionItem = {
        cid: makeCid(),
        snippetId: snippet.id,
        label: snippet.label,
        type: snippet.type,
        content: snippet.content,
        source: recommendedSet.has(snippet.id) ? 'default' : 'manual',
        incoterm: snippet.incoterm ?? null,
        transportMode: snippet.transportMode ?? null,
      };
      return [next];
    });
  };

  const removeByCid = (cid: string) => {
    setInternal((items) => items.filter((candidate) => candidate.cid !== cid));
  };

  const addCustom = () => {
    const type = fromRuleKey(fieldKey);
    setInternal([
      {
        cid: makeCid(),
        snippetId: null,
        label: `${typeLabels[type]} - ${customSuffix}`,
        type,
        content: '',
        source: 'custom',
        incoterm: null,
        transportMode: null,
      },
    ]);
  };

  const saveChanges = () => {
    onChange(strip(internal));
    skipResetRef.current = true;
    setOpen(false);
  };

  const cancelChanges = () => {
    skipResetRef.current = false;
    setInternal(limitToSingle(selections));
    setSearch('');
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      skipResetRef.current = false;
      setOpen(true);
      return;
    }
    setOpen(false);
    if (!skipResetRef.current) {
      setInternal(limitToSingle(selections));
    }
    setSearch('');
    skipResetRef.current = false;
  };

  const renderSnippetMeta = (snippet: QuotationRuleSnippet) => (
    <div className="text-muted-foreground flex flex-wrap gap-1 text-[11px]">
      <Badge variant="outline">{typeLabels[snippet.type]}</Badge>
      <Badge variant="outline">{snippet.incoterm ?? t('quotation.rules.anyIncoterm')}</Badge>
      <Badge variant="outline">{snippet.transportMode ?? t('quotation.rules.anyTransport')}</Badge>
      {recommendedSet.has(snippet.id) && (
        <Badge variant="secondary">{t('quotation.rules.recommended')}</Badge>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-center">
        <div>
          <Label htmlFor={`rule-${fieldKey}`}>{label}</Label>
          {description && <p className="text-muted-foreground text-xs sm:text-sm">{description}</p>}
        </div>
        <div className="flex w-full justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(true)}
            className="w-full sm:w-auto"
          >
            {t('quotation.rules.manageButton')}
          </Button>
        </div>
      </div>
      <Textarea
        id={`rule-${fieldKey}`}
        value={summary}
        readOnly
        rows={summaryRows}
        className="min-h-[72px] w-full resize-none"
        placeholder={t('quotation.rules.placeholder')}
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[80vh] w-full max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{`${t('quotation.rules.manageTitle')} · ${label}`}</DialogTitle>
            <DialogDescription>{t('quotation.rules.manageDescription')}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
                <Input
                  placeholder={t('quotation.rules.searchPlaceholder')}
                  className="pl-9"
                  value={search}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                />
              </div>
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b px-4 py-2 text-sm font-medium">
                  <span>{t('quotation.rules.availableSnippets')}</span>
                  {loading && (
                    <span className="text-muted-foreground text-xs">{t('common.loading')}</span>
                  )}
                </div>
                <div className="max-h-[340px] space-y-1.5 overflow-y-auto p-2">
                  {!loading && filtered.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      {t('quotation.rules.noSnippets')}
                    </p>
                  )}
                  {filtered.map((snippet) => {
                    const selected = selectionIds.has(snippet.id);
                    return (
                      <button
                        key={snippet.id}
                        type="button"
                        onClick={() => toggleSnippet(snippet)}
                        className={cn(
                          'hover:bg-muted/60 w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                          selected ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{snippet.label}</span>
                            {renderSnippetMeta(snippet)}
                          </div>
                          <span className="text-muted-foreground text-xs font-medium">
                            {selected ? t('quotation.rules.remove') : t('quotation.rules.add')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t('quotation.rules.selectedSnippets')}</div>
                <Button variant="outline" size="sm" onClick={addCustom}>
                  <Plus className="mr-1 h-4 w-4" /> {t('quotation.rules.addCustomLine')}
                </Button>
              </div>
              <div className="space-y-2.5">
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <SortableContext items={internal.map((item) => item.cid)}>
                    {internal.length === 0 && (
                      <p className="text-muted-foreground text-sm">
                        {t('quotation.rules.noSelection')}
                      </p>
                    )}
                    {internal.map((item, index) => (
                      <SortableSelection
                        key={item.cid}
                        item={item}
                        onChangeContent={(value) =>
                          setInternal((items) => {
                            const draft = [...items];
                            const previous = draft[index];
                            draft[index] = {
                              ...previous,
                              content: value,
                              source:
                                previous.source === 'default' && previous.content !== value
                                  ? 'manual'
                                  : previous.source,
                            };
                            return draft;
                          })
                        }
                        onChangeLabel={(value) =>
                          setInternal((items) => {
                            const draft = [...items];
                            draft[index] = { ...draft[index], label: value };
                            return draft;
                          })
                        }
                        onRemove={() => removeByCid(item.cid)}
                        typeLabels={typeLabels}
                        defaultHint={defaultHint}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelChanges}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveChanges}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
