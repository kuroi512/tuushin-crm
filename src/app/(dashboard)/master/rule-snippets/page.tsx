'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useT } from '@/lib/i18n';
import type { QuotationRuleSnippet, RuleSnippetType } from '@/types/quotation';
import {
  useCreateRuleSnippet,
  useDeleteRuleSnippet,
  useRuleSnippets,
  useUpdateRuleSnippet,
} from '@/components/quotations/useRuleSnippetsAdmin';
import { cn } from '@/lib/utils';
import { useLookup, type LookupOption } from '@/components/lookup/hooks';

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'] as const;
const FALLBACK_TRANSPORT_MODES = [
  '20ft Truck',
  '40ft Truck',
  '20ft Container',
  '40ft Container',
  'Car Carrier',
] as const;

const TRANSPORT_MODE_CODE_HINTS = ['transport', 'transport_mode', 'transport-mode', 'tmode'];

const collectMetaStrings = (meta: unknown): string[] => {
  const acc: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      acc.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  };
  visit(meta);
  return acc;
};

const matchesTransportHint = (value: string) =>
  TRANSPORT_MODE_CODE_HINTS.some((hint) => value.includes(hint));

const isTransportModeOption = (option: LookupOption | undefined | null) => {
  if (!option || !option.name) return false;
  const name = option.name.toLowerCase();
  if (matchesTransportHint(name)) return true;
  const code = (option.code || '').toLowerCase();
  if (code && matchesTransportHint(code)) return true;
  const metaStrings = collectMetaStrings(option.meta).map((entry) => entry.toLowerCase());
  return metaStrings.some(matchesTransportHint);
};

type TypeFilter = 'ALL' | RuleSnippetType;

interface FormState {
  label: string;
  type: RuleSnippetType;
  incoterm: string;
  transportMode: string;
  content: string;
  isActive: boolean;
  mnContent: string;
  ruContent: string;
}

const DEFAULT_FORM: FormState = {
  label: '',
  type: 'INCLUDE',
  incoterm: '',
  transportMode: '',
  content: '',
  isActive: true,
  mnContent: '',
  ruContent: '',
};

export default function RuleSnippetsMasterPage() {
  const t = useT();
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = useMemo(() => normalizeRole(session?.user?.role), [session?.user?.role]);
  const canAccess = hasPermission(role, 'accessMasterData');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [incotermFilter, setIncotermFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationRuleSnippet | null>(null);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });

  useEffect(() => {
    if (status === 'loading') return;
    if (!canAccess) {
      router.replace('/dashboard');
    }
  }, [status, canAccess, router]);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useRuleSnippets({
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    incoterm: incotermFilter || undefined,
    includeInactive: showInactive,
    search: search || undefined,
  });

  const snippets = query.data?.data ?? [];

  const { mutate: createSnippet, isPending: createPending } = useCreateRuleSnippet();
  const { mutate: updateSnippet, isPending: updatePending } = useUpdateRuleSnippet();
  const { mutate: deleteSnippet, isPending: deletePending } = useDeleteRuleSnippet();

  const submitting = createPending || updatePending;
  const { data: typeLookup, isLoading: typeLoading } = useLookup('type', {
    include: ['code', 'meta'],
  });

  const transportModeOptions = useMemo(() => {
    const typeEntries = (typeLookup?.data || []).filter(
      (item): item is LookupOption => Boolean(item) && Boolean(item.name),
    );

    const inferred = typeEntries
      .filter((item) => isTransportModeOption(item))
      .map((item) => item.name);
    if (inferred.length) return inferred;

    const allNames = typeEntries
      .map((item) => item.name)
      .filter((name): name is string => Boolean(name));
    if (allNames.length) return allNames;

    return [...FALLBACK_TRANSPORT_MODES];
  }, [typeLookup?.data]);

  const resolvedTransportModes = useMemo(() => {
    const set = new Set(transportModeOptions);
    if (form.transportMode && !set.has(form.transportMode)) {
      set.add(form.transportMode);
    }
    return Array.from(set);
  }, [form.transportMode, transportModeOptions]);

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = useCallback((snippet: QuotationRuleSnippet) => {
    const translations = (snippet.contentTranslations ?? {}) as Record<string, string | undefined>;
    setEditing(snippet);
    setForm({
      label: snippet.label,
      type: snippet.type,
      incoterm: snippet.incoterm ?? '',
      transportMode: snippet.transportMode ?? '',
      content: snippet.content,
      isActive: snippet.isActive,
      mnContent: translations.mn ?? '',
      ruContent: translations.ru ?? '',
    });
    setDialogOpen(true);
  }, []);

  const handleToggleActive = useCallback(
    (snippet: QuotationRuleSnippet) => {
      updateSnippet(
        { id: snippet.id, isActive: !snippet.isActive },
        {
          onSuccess: () => {
            toast.success(snippet.isActive ? 'Snippet deactivated' : 'Snippet activated');
          },
          onError: (error: Error) => toast.error(error.message),
        },
      );
    },
    [updateSnippet],
  );

  const handleDelete = useCallback(
    (snippet: QuotationRuleSnippet) => {
      deleteSnippet(
        { id: snippet.id, force: true },
        {
          onSuccess: () => toast.success('Snippet permanently deleted'),
          onError: (error: Error) => toast.error(error.message),
        },
      );
    },
    [deleteSnippet],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      label: form.label.trim(),
      type: form.type,
      incoterm: form.incoterm.trim() ? form.incoterm.trim().toUpperCase() : null,
      transportMode: form.transportMode.trim() ? form.transportMode.trim() : null,
      content: form.content.trim(),
      isActive: form.isActive,
      translations: {
        en: form.content.trim(),
        mn: form.mnContent.trim(),
        ru: form.ruContent.trim(),
      },
    };

    if (!payload.label) {
      toast.error('Label is required');
      return;
    }
    if (!payload.content) {
      toast.error('Content is required');
      return;
    }

    if (editing) {
      updateSnippet(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Snippet updated');
            setDialogOpen(false);
            resetForm();
          },
          onError: (error: Error) => toast.error(error.message),
        },
      );
    } else {
      createSnippet(payload, {
        onSuccess: () => {
          toast.success('Snippet created');
          setDialogOpen(false);
          resetForm();
        },
        onError: (error: Error) => toast.error(error.message),
      });
    }
  };

  const typeLabels = useMemo<Record<RuleSnippetType, string>>(
    () => ({
      INCLUDE: t('quotation.rules.type.include'),
      EXCLUDE: t('quotation.rules.type.exclude'),
      REMARK: t('quotation.rules.type.remark'),
    }),
    [t],
  );

  const columns: ColumnDef<QuotationRuleSnippet>[] = useMemo(
    () => [
      {
        accessorKey: 'label',
        header: 'Label',
        cell: ({ row }) => {
          const snippet = row.original;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{snippet.label}</span>
              </div>
              <span className="text-muted-foreground text-xs">
                Updated{' '}
                {new Date(snippet.updatedAt ?? snippet.createdAt ?? Date.now()).toLocaleString()}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const snippet = row.original;
          const tone =
            snippet.type === 'INCLUDE'
              ? 'bg-blue-100 text-blue-800 border-blue-200'
              : snippet.type === 'EXCLUDE'
                ? 'bg-red-100 text-red-800 border-red-200'
                : 'bg-amber-100 text-amber-800 border-amber-200';
          return (
            <Badge variant="outline" className={cn('font-medium', tone)}>
              {typeLabels[snippet.type]}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'incoterm',
        header: 'Incoterm',
        cell: ({ row }) => row.original.incoterm || 'Any',
      },
      {
        accessorKey: 'transportMode',
        header: 'Transport Mode',
        cell: ({ row }) => row.original.transportMode || 'Any',
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const snippet = row.original;
          return (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(snippet)}>
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={updatePending}
                onClick={() => handleToggleActive(snippet)}
              >
                {snippet.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deletePending}
                onClick={() => handleDelete(snippet)}
              >
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [deletePending, handleDelete, handleToggleActive, openEdit, typeLabels, updatePending],
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">Loading…</div>
    );
  }

  if (!canAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Include / Exclude Snippets</h1>
        <p className="text-sm text-gray-600">
          Maintain reusable snippets tied to Incoterm and transport mode. Changes here affect future
          quotations.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-gray-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Snippet Catalog</CardTitle>
            <CardDescription>
              Search, filter, and maintain include/exclude/remark templates.
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> New snippet
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium uppercase">Type</Label>
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as TypeFilter)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All types</SelectItem>
                  <SelectItem value="INCLUDE">{typeLabels.INCLUDE}</SelectItem>
                  <SelectItem value="EXCLUDE">{typeLabels.EXCLUDE}</SelectItem>
                  <SelectItem value="REMARK">{typeLabels.REMARK}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium uppercase">Incoterm</Label>
              <Select
                value={incotermFilter || 'ANY'}
                onValueChange={(value) => setIncotermFilter(value === 'ANY' ? '' : value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">Any</SelectItem>
                  {INCOTERMS.map((inc) => (
                    <SelectItem key={inc} value={inc}>
                      {inc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <Label className="mb-1 block text-xs font-medium uppercase">Search</Label>
              <Input
                placeholder={t('quotation.rules.searchPlaceholder')}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              Show inactive
            </label>
          </div>

          <div className="text-muted-foreground text-sm">
            Showing {snippets.length} snippet{snippets.length === 1 ? '' : 's'}
            {typeFilter !== 'ALL' && ` • Type: ${typeLabels[typeFilter]}`}
            {incotermFilter && ` • Incoterm: ${incotermFilter}`}
            {showInactive ? ' • Including inactive entries' : ''}
          </div>

          <DataTable columns={columns} data={snippets} />

          {query.isLoading && <div className="text-sm text-gray-500">Loading snippets…</div>}
          {!query.isLoading && snippets.length === 0 && (
            <div className="text-sm text-gray-500">No snippets match your filters.</div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="w-full max-w-[80vw]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit snippet' : 'Create snippet'}</DialogTitle>
              <DialogDescription>
                {editing
                  ? 'Update the reusable snippet. Existing quotations keep their current text.'
                  : 'Define a reusable snippet that will be available in quotation forms.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 md:col-span-2 lg:col-span-4">
                <Label className="text-sm font-medium">Label</Label>
                <Input
                  value={form.label}
                  onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="e.g. EXW Truck – Includes"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, type: value as RuleSnippetType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCLUDE">{typeLabels.INCLUDE}</SelectItem>
                    <SelectItem value="EXCLUDE">{typeLabels.EXCLUDE}</SelectItem>
                    <SelectItem value="REMARK">{typeLabels.REMARK}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Incoterm</Label>
                <Select
                  value={form.incoterm || 'ANY'}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, incoterm: value === 'ANY' ? '' : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any</SelectItem>
                    {INCOTERMS.map((inc) => (
                      <SelectItem key={inc} value={inc}>
                        {inc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Transport mode</Label>
                <Select
                  value={form.transportMode || 'ANY'}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, transportMode: value === 'ANY' ? '' : value }))
                  }
                  disabled={typeLoading && transportModeOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any</SelectItem>
                    {resolvedTransportModes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2 lg:col-span-1">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Active
              </label>
              <div className="space-y-2 md:col-span-2 lg:col-span-4">
                <Label className="text-sm font-medium">Content</Label>
                <Textarea
                  value={form.content}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, content: event.target.value }))
                  }
                  rows={8}
                  placeholder={
                    'Describe what is included/excluded or add remarks. You can use multiple lines.'
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-4">
                <Label className="text-sm font-medium">Content (Mongolian)</Label>
                <Textarea
                  value={form.mnContent}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, mnContent: event.target.value }))
                  }
                  rows={6}
                  placeholder="Монгол орчуулга энд бичнэ үү"
                />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-4">
                <Label className="text-sm font-medium">Content (Russian)</Label>
                <Textarea
                  value={form.ruContent}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, ruContent: event.target.value }))
                  }
                  rows={6}
                  placeholder="Введите русский перевод здесь"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create snippet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
