'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { useT } from '@/lib/i18n';
import { Plus } from 'lucide-react';
import { useQuotationColumns } from '@/components/quotations/columns';
import { ColumnManagerModal } from '@/components/quotations/ColumnManagerModal';
import { FiltersPanel } from '@/components/quotations/FiltersPanel';
import { Quotation } from '@/types/quotation';

// Quotation type is extracted to src/types/quotation.ts

import { useSession } from 'next-auth/react';

export default function QuotationsPage() {
  const t = useT();
  const { data: session } = useSession();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewQuotationForm, setShowNewQuotationForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Persisted column settings
  const userKey = session?.user?.email ?? 'guest';
  const STORAGE_KEY = `quotation_table_columns_v1:${userKey}`;
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [tableKey, setTableKey] = useState(0);
  const [searchValue, setSearchValue] = useState('');

  // New form state
  const [form, setForm] = useState({
    client: '', cargoType: '', origin: '', destination: '', weight: '', volume: '', estimatedCost: ''
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/quotations');
        const json = await res.json();
        if (json?.data) setQuotations(json.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load saved columns
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { order: string[]; visibility: Record<string, boolean> };
        setColumnOrder(parsed.order);
        setColumnVisibility(parsed.visibility);
      }
    } catch {}
  }, [STORAGE_KEY]);

  const submitNewQuotation = async () => {
    try {
      const payload = {
        client: form.client,
        cargoType: form.cargoType,
        origin: form.origin,
        destination: form.destination,
        weight: form.weight ? Number(form.weight) : undefined,
        volume: form.volume ? Number(form.volume) : undefined,
        estimatedCost: Number(form.estimatedCost),
      };
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json?.data) {
        setQuotations((prev) => [json.data, ...prev]);
        setShowNewQuotationForm(false);
        setForm({ client: '', cargoType: '', origin: '', destination: '', weight: '', volume: '', estimatedCost: '' });
      } else {
        console.error(json?.error || 'Failed to create');
      }
    } catch (e) {
      console.error('Create quotation error:', e);
    }
  };

  const columns: ColumnDef<Quotation>[] = useQuotationColumns();

  // Build current column IDs from definitions
  const allColumnIds = columns.map((c) => (c as any).id || (c as any).accessorKey).filter(Boolean) as string[];
  const mergedOrder = columnOrder.length ? [...columnOrder, ...allColumnIds.filter((id) => !columnOrder.includes(id))] : allColumnIds;
  const listIds = mergedOrder;

  // Materialize ordered columns if a saved order exists
  const orderedColumns = columnOrder.length
    ? mergedOrder
        .map((id) => columns.find((c) => ((c as any).id || (c as any).accessorKey) === id))
        .filter(Boolean) as ColumnDef<Quotation>[]
    : columns;

  // Initial visibility from saved settings
  const initialVisibility = Object.keys(columnVisibility).length
    ? columnVisibility
    : undefined;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('quotations.title')}</h1>
          <p className="text-gray-600">{t('quotations.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
      <div className="relative flex-1 min-w-[260px]">
            <Input
              placeholder={t('quotations.search.placeholder')}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8"
            />
            <span className="pointer-events-none absolute left-2 top-2.5 text-gray-400">🔎</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>{t('quotations.filters')}</Button>
            <Button variant="outline" onClick={() => setShowColumnManager((v) => !v)}>Columns</Button>
            <Button onClick={() => setShowNewQuotationForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t('quotations.new')}
            </Button>
          </div>
        </div>
      </div>

      <ColumnManagerModal
        open={showColumnManager}
        onClose={() => { setShowColumnManager(false); setTableKey((k) => k + 1); }}
        allColumns={columns}
        order={mergedOrder}
        setOrder={(next) => setColumnOrder(next)}
        visibility={columnVisibility}
        setVisibility={(next) => setColumnVisibility(next)}
        storageKey={STORAGE_KEY}
      />

      {/* Filters Panel */}
  {showFilters && <FiltersPanel />}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quotations.table.all')}</CardTitle>
          <CardDescription>
            {loading ? t('quotations.table.loading') : t('quotations.table.desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            key={tableKey}
            columns={orderedColumns}
            data={quotations}
            searchKey="client"
            searchPlaceholder={t('quotations.search.placeholder')}
            externalSearchValue={searchValue}
            hideBuiltInSearch={true}
            hideColumnVisibilityMenu={true}
            enableRowReordering={false}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            initialColumnVisibility={initialVisibility}
            enablePagination={true}
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* New Quotation Modal */}
      {showNewQuotationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Quotation</CardTitle>
              <CardDescription>Enter quotation details for freight services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client">Client</Label>
                  <Input id="client" placeholder="Client company name" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="cargoType">Cargo Type</Label>
                  <Input id="cargoType" placeholder="e.g., Copper Concentrate" value={form.cargoType} onChange={(e) => setForm({ ...form, cargoType: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="origin">Origin</Label>
                  <Input id="origin" placeholder="Origin location" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="destination">Destination</Label>
                  <Input id="destination" placeholder="Destination location" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" placeholder="25000" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="volume">Volume (m³)</Label>
                  <Input id="volume" type="number" step="0.1" placeholder="45.5" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="estimatedCost">Estimated Cost (USD)</Label>
                  <Input id="estimatedCost" type="number" placeholder="12000" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowNewQuotationForm(false)}>
                  Cancel
                </Button>
                <Button onClick={submitNewQuotation}>Create Quotation</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
