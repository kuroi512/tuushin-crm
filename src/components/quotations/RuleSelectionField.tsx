'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
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
import { GripVertical, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type {
  QuotationRuleSelection,
  QuotationRuleSelectionState,
  QuotationRuleSnippet,
  RuleSnippetType,
} from '@/types/quotation';
import { buildRuleText, fromRuleKey } from './useRuleCatalog';
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
  variant?: 'full' | 'compact';
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
  variant = 'full',
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
  const [internal, setInternal] = useState<SelectionItem[]>(augment(selections));
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const commitImmediately = variant === 'compact';
  const allowCustom = variant === 'full';

  useEffect(() => {
    if (variant === 'compact' || !open) {
      setInternal(augment(selections));
    }
  }, [selections, open, variant]);

  useEffect(() => {
    if (variant === 'full' && !open) {
      setSearch('');
    }
  }, [open, variant]);

  useEffect(() => {
    if (variant === 'compact' && !menuOpen) {
      setSearch('');
    }
  }, [menuOpen, variant]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
  const summary = useMemo(() => buildRuleText(selections), [selections]);
  const previewRows = variant === 'compact' ? 3 : 6;
  const commitToParent = (items: SelectionItem[]) => onChange(strip(items));
  const moveUp = (index: number) => {
    setInternal((items) => {
      if (index <= 0) return items;
      const next = arrayMove(items, index, index - 1);
      if (commitImmediately) commitToParent(next);
      return next;
    });
  };
  const moveDown = (index: number) => {
    setInternal((items) => {
      if (index >= items.length - 1) return items;
      const next = arrayMove(items, index, index + 1);
      if (commitImmediately) commitToParent(next);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setInternal((items) => {
      const oldIndex = items.findIndex((item) => item.cid === active.id);
      const newIndex = items.findIndex((item) => item.cid === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      const nextItems = arrayMove(items, oldIndex, newIndex);
      if (commitImmediately) {
        commitToParent(nextItems);
      }
      return nextItems;
    });
  };

  const toggleSnippet = (snippet: QuotationRuleSnippet) => {
    setInternal((items) => {
      const existingIndex = items.findIndex((item) => item.snippetId === snippet.id);
      let nextItems: SelectionItem[];
      if (existingIndex >= 0) {
        nextItems = [...items.slice(0, existingIndex), ...items.slice(existingIndex + 1)];
      } else {
        const next: SelectionItem = {
          cid: makeCid(),
          snippetId: snippet.id,
          label: snippet.label,
          type: snippet.type,
          content: snippet.content,
          source: recommendedIds?.includes(snippet.id) ? 'default' : 'manual',
          incoterm: snippet.incoterm ?? null,
          transportMode: snippet.transportMode ?? null,
        };
        nextItems = [...items, next];
      }
      if (commitImmediately) {
        commitToParent(nextItems);
      }
      return nextItems;
    });
  };

  const removeByCid = (cid: string) => {
    setInternal((items) => {
      const nextItems = items.filter((candidate) => candidate.cid !== cid);
      if (commitImmediately) {
        commitToParent(nextItems);
      }
      return nextItems;
    });
  };

  const addCustom = () => {
    const type = fromRuleKey(fieldKey);
    setInternal((items) => {
      const customItem: SelectionItem = {
        cid: makeCid(),
        snippetId: null,
        label: `${typeLabels[type]} - ${customSuffix}`,
        type,
        content: '',
        source: 'custom',
        incoterm: null,
        transportMode: null,
      };
      const nextItems = [...items, customItem];
      if (commitImmediately) {
        commitToParent(nextItems);
      }
      return nextItems;
    });
  };

  const saveChanges = () => {
    if (variant === 'full') {
      onChange(strip(internal));
      setOpen(false);
    }
  };

  const recommendedSet = useMemo(() => new Set(recommendedIds || []), [recommendedIds]);

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        <Label htmlFor={`rule-${fieldKey}`}>{label}</Label>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-md border bg-white px-3 py-2">
            {internal.length > 0 ? (
              internal.map((item, index) => (
                <span
                  key={item.cid}
                  className="bg-muted flex items-center gap-1 rounded-full px-2 py-1 text-xs sm:text-sm"
                  title={item.label}
                >
                  <span className="max-w-[10rem] truncate sm:max-w-[12rem]">{item.label}</span>
                  <div className="text-muted-foreground flex items-center gap-0.5">
                    <button
                      type="button"
                      className="hover:bg-muted-foreground/20 rounded-full p-1 transition"
                      onClick={() => moveUp(index)}
                      aria-label={t('quotation.rules.moveUp')}
                      disabled={index === 0}
                    >
                      <span className="block text-[10px] leading-none">↑</span>
                    </button>
                    <button
                      type="button"
                      className="hover:bg-muted-foreground/20 rounded-full p-1 transition"
                      onClick={() => moveDown(index)}
                      aria-label={t('quotation.rules.moveDown')}
                      disabled={index === internal.length - 1}
                    >
                      <span className="block text-[10px] leading-none">↓</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeByCid(item.cid)}
                    className="text-muted-foreground hover:text-foreground transition"
                    aria-label={t('quotation.rules.remove')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">
                {t('quotation.rules.noSelection')}
              </span>
            )}
          </div>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 whitespace-nowrap">
                {t('quotation.rules.manageButton')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[22rem] p-0">
              <div className="border-b px-3 py-2 text-sm font-medium">
                {t('quotation.rules.availableSnippets')}
              </div>
              <div className="border-b p-2">
                <Input
                  placeholder={t('quotation.rules.searchPlaceholder')}
                  value={search}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {loading && (
                  <div className="text-muted-foreground px-3 py-2 text-xs">
                    {t('common.loading')}
                  </div>
                )}
                {!loading && filtered.length === 0 && (
                  <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                    {t('quotation.rules.noSnippets')}
                  </div>
                )}
                {!loading &&
                  filtered.map((snippet) => {
                    const selected = selectionIds.has(snippet.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={snippet.id}
                        checked={selected}
                        onCheckedChange={() => toggleSnippet(snippet)}
                        className="items-start gap-3 px-3 py-2 text-left leading-tight"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-sm leading-tight font-medium">{snippet.label}</span>
                          <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
                            {snippet.content}
                          </span>
                        </div>
                        <div className="text-muted-foreground ml-auto flex flex-col items-end gap-1 text-[11px]">
                          {snippet.incoterm && <Badge variant="outline">{snippet.incoterm}</Badge>}
                          {snippet.transportMode && (
                            <Badge variant="outline">{snippet.transportMode}</Badge>
                          )}
                          {recommendedSet.has(snippet.id) && (
                            <span className="text-blue-600">
                              {t('quotation.rules.recommended')}
                            </span>
                          )}
                        </div>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Textarea
          id={`rule-${fieldKey}`}
          value={summary}
          readOnly
          rows={previewRows}
          className="min-h-[48px] resize-none"
          placeholder={t('quotation.rules.placeholder')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`rule-${fieldKey}`}>{label}</Label>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      <div className="flex items-start gap-2">
        <Textarea
          id={`rule-${fieldKey}`}
          value={summary}
          readOnly
          rows={previewRows}
          className="flex-1"
          placeholder={t('quotation.rules.placeholder')}
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="whitespace-nowrap">
              {t('quotation.rules.manageButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] w-full max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{`${t('quotation.rules.manageTitle')} · ${label}`}</DialogTitle>
              <DialogDescription>{t('quotation.rules.manageDescription')}</DialogDescription>
            </DialogHeader>
            <div className="mt-2 grid gap-4 lg:grid-cols-[1fr,1.2fr]">
              <div className="space-y-2.5">
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
                      <span className="text-muted-foreground">{t('common.loading')}</span>
                    )}
                  </div>
                  <div className="max-h-[320px] space-y-1.5 overflow-y-auto p-2">
                    {filtered.length === 0 && (
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
                          className={cn(
                            'hover:bg-muted/40 w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors',
                            selected ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white',
                          )}
                          onClick={() => toggleSnippet(snippet)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{snippet.label}</div>
                              <div className="text-muted-foreground line-clamp-2 text-xs leading-snug">
                                {snippet.content}
                              </div>
                            </div>
                            <div className="text-muted-foreground flex flex-col items-end gap-1 text-[11px]">
                              {snippet.incoterm && (
                                <Badge variant="outline">{snippet.incoterm}</Badge>
                              )}
                              {snippet.transportMode && (
                                <Badge variant="outline">{snippet.transportMode}</Badge>
                              )}
                              {recommendedSet.has(snippet.id) && (
                                <span className="text-blue-600">
                                  {t('quotation.rules.recommended')}
                                </span>
                              )}
                              <span className="font-medium">
                                {selected ? t('quotation.rules.remove') : t('quotation.rules.add')}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{t('quotation.rules.selectedSnippets')}</div>
                  {allowCustom && (
                    <Button variant="outline" size="sm" onClick={addCustom}>
                      <Plus className="mr-1 h-4 w-4" /> {t('quotation.rules.addCustomLine')}
                    </Button>
                  )}
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
                              const nextSource =
                                previous.source === 'default' && previous.content !== value
                                  ? 'manual'
                                  : previous.source;
                              draft[index] = {
                                ...previous,
                                content: value,
                                source: nextSource,
                              };
                              if (commitImmediately) {
                                commitToParent(draft);
                              }
                              return draft;
                            })
                          }
                          onChangeLabel={(value) =>
                            setInternal((items) => {
                              const draft = [...items];
                              draft[index] = { ...draft[index], label: value };
                              if (commitImmediately) {
                                commitToParent(draft);
                              }
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
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={saveChanges}>{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
