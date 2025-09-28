'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MasterTable } from '@/components/master/MasterTable';
import {
  useMasterOptions,
  useCreateMasterOption,
  useUpdateMasterOption,
  useDeleteMasterOption,
} from '@/components/master/hooks';
import { toast } from 'sonner';
import { Plus, RefreshCcw } from 'lucide-react';

interface FormState {
  id?: string;
  name: string;
  code?: string | null;
  meta?: string; // JSON string
}

const categoryMap: Record<string, string> = {
  type: 'TYPE',
  ownership: 'OWNERSHIP',
  customer: 'CUSTOMER',
  agent: 'AGENT',
  country: 'COUNTRY',
  port: 'PORT',
  area: 'AREA',
  exchange: 'EXCHANGE',
  sales: 'SALES',
  manager: 'MANAGER',
};

export default function MasterCategoryPage() {
  const params = useParams();
  const slug = (params?.slug as string) || 'type';
  const category = categoryMap[slug];
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '' });

  const { data, isLoading } = useMasterOptions(category);
  const createMutation = useCreateMasterOption();
  const updateMutation = useUpdateMasterOption(category);
  const deleteMutation = useDeleteMasterOption(category);

  useEffect(() => {
    if (!editing) setForm({ name: '' });
  }, [category, editing]);

  if (!category) {
    return <div className="p-6 text-sm text-red-600">Unknown category: {slug}</div>;
  }

  function openCreate() {
    setEditing(false);
    setForm({ name: '' });
    setShowModal(true);
  }

  function openEdit(row: any) {
    setEditing(true);
    setForm({
      id: row.id,
      name: row.name,
      code: row.code ?? undefined,
      meta: row.meta ? JSON.stringify(row.meta, null, 2) : '',
    });
    setShowModal(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    let metaObj: any | undefined;
    if (form.meta) {
      try {
        metaObj = JSON.parse(form.meta);
      } catch {
        toast.error('Meta JSON invalid');
        return;
      }
    }
    if (editing && form.id) {
      updateMutation.mutate(
        { id: form.id, name: form.name, code: form.code ?? undefined, meta: metaObj },
        {
          onSuccess: () => {
            toast.success('Updated');
            setShowModal(false);
          },
          onError: (e: any) => toast.error(e.message || 'Update failed'),
        },
      );
    } else {
      createMutation.mutate(
        { category, name: form.name, code: form.code ?? undefined, meta: metaObj },
        {
          onSuccess: () => {
            toast.success('Created');
            setShowModal(false);
            setForm({ name: '' });
          },
          onError: (e: any) => toast.error(e.message || 'Create failed'),
        },
      );
    }
  }

  async function handleSync() {
    try {
      const res = await fetch('/api/master/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Sync failed');
      toast.success(
        `Sync complete: +${json.stats.inserted} / ~${json.stats.updated} updated / ${json.stats.deactivated} deactivated`,
      );
    } catch (e: any) {
      toast.error(e.message || 'Sync error');
    }
  }

  const busy = isLoading || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Master Data - {category}</h1>
          <p className="text-sm text-gray-600">Manage internal options (external are read-only).</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={busy}
            title="Fetch & sync external master data"
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Sync
          </Button>
          <Button onClick={openCreate} disabled={busy} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{category} Options</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterTable data={data?.data || []} loading={busy} onEdit={openEdit} />
        </CardContent>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-md border bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editing ? 'Edit Master Option' : 'Create Master Option'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-gray-100"
                  value={category}
                  disabled
                  readOnly
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Code</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.code || ''}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value || undefined }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Meta (JSON)</label>
                <textarea
                  className="h-32 w-full rounded-md border px-3 py-2 font-mono text-xs"
                  value={form.meta || ''}
                  onChange={(e) => setForm((f) => ({ ...f, meta: e.target.value }))}
                  placeholder='{"note": "Local only"}'
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={busy}>
                {editing ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
