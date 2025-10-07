'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
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

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'] as const;
const TRANSPORT_MODES = [
  '20ft Truck',
  '40ft Truck',
  '20ft Container',
  '40ft Container',
  'Car Carrier',
] as const;

type TypeFilter = 'ALL' | RuleSnippetType;

interface FormState {
  label: string;
  type: RuleSnippetType;
  incoterm: string;
  transportMode: string;
  content: string;
  isDefault: boolean;
  isActive: boolean;
  order: number;
}

const DEFAULT_FORM: FormState = {
  label: '',
  type: 'INCLUDE',
  incoterm: '',
  transportMode: '',
  content: '',
  isDefault: false,
  isActive: true,
  order: 0,
};

export default function RuleSnippetsMasterPage() {
  const t = useT();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [incotermFilter, setIncotermFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationRuleSnippet | null>(null);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });

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

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = useCallback((snippet: QuotationRuleSnippet) => {
    setEditing(snippet);
    setForm({
      label: snippet.label,
      type: snippet.type,
      incoterm: snippet.incoterm ?? '',
      transportMode: snippet.transportMode ?? '',
      content: snippet.content,
      isDefault: snippet.isDefault,
      isActive: snippet.isActive,
      order: snippet.order ?? 0,
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
      isDefault: form.isDefault,
      order: Number.isFinite(form.order) ? form.order : 0,
      isActive: form.isActive,
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
                {snippet.isDefault && <Badge variant="secondary">Default</Badge>}
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
        accessorKey: 'order',
        header: 'Order',
        cell: ({ row }) => row.original.order,
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

  const handleOrderChange = (value: string) => {
    const numeric = Number(value);
    setForm((prev) => ({ ...prev, order: Number.isNaN(numeric) ? prev.order : numeric }));
  };

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
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit snippet' : 'Create snippet'}</DialogTitle>
              <DialogDescription>
                {editing
                  ? 'Update the reusable snippet. Existing quotations keep their current text.'
                  : 'Define a reusable snippet that will be available in quotation forms.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
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
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any</SelectItem>
                    {TRANSPORT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort order</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(event) => handleOrderChange(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.isDefault}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, isDefault: event.target.checked }))
                    }
                  />
                  Mark as default suggestion
                </label>
                <label className="flex items-center gap-2 text-sm">
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
              </div>
              <div className="space-y-2 sm:col-span-2">
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
