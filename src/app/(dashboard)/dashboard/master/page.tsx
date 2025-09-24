'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { MasterTable } from '@/components/master/MasterTable';
import {
  useMasterOptions,
  useCreateMasterOption,
  useUpdateMasterOption,
} from '@/components/master/hooks';
import { toast } from 'sonner';

// Placeholder - will be replaced by real hook later
interface FormState {
  id?: string;
  name: string;
  code?: string | null;
  meta?: string; // JSON string input
}

const categories = [
  'TYPE',
  'OWNERSHIP',
  'CUSTOMER',
  'AGENT',
  'COUNTRY',
  'PORT',
  'AREA',
  'EXCHANGE',
  'SALES',
  'MANAGER',
];

export default function MasterManagementPage() {
  const [category, setCategory] = useState<string>('TYPE');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '' });

  const { data, isLoading, refetch } = useMasterOptions(category);
  const createMutation = useCreateMasterOption();
  const updateMutation = useUpdateMasterOption(category);

  // Reset form when category changes if creating new
  useEffect(() => {
    if (!editing) setForm({ name: '' });
  }, [category, editing]);

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
    if (editing && form.id) {
      let metaObj: any | undefined;
      if (form.meta) {
        try {
          metaObj = JSON.parse(form.meta);
        } catch {
          toast.error('Meta JSON invalid');
          return;
        }
      }
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
      let metaObj: any | undefined;
      if (form.meta) {
        try {
          metaObj = JSON.parse(form.meta);
        } catch {
          toast.error('Meta JSON invalid');
          return;
        }
      }
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Data</h1>
          <p className="text-gray-600">
            Manage internal master options; external options are read-only.
          </p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Option
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Category</CardTitle>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <MasterTable
            data={data?.data || []}
            loading={isLoading || createMutation.isPending || updateMutation.isPending}
            onEdit={openEdit}
          />
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
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
