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
import { ComboBox } from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DraftsModal, addDraft, QuotationDraft } from '@/components/quotations/DraftsModal';
import { toast } from 'sonner';

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
  const [showDrafts, setShowDrafts] = useState(false);

  // Persisted column settings
  const userKey = session?.user?.email ?? 'guest';
  const STORAGE_KEY = `quotation_table_columns_v1:${userKey}`;
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [tableKey, setTableKey] = useState(0);
  const [searchValue, setSearchValue] = useState('');

  // New form state
  const DRAFT_KEY = 'quotation_draft_v1';
  const [form, setForm] = useState({
    client: '',
    cargoType: '',
    origin: '',
    destination: '',
    weight: '',
    volume: '',
    estimatedCost: '',
    division: 'import',
    incoterm: 'EXW',
    paymentType: 'Prepaid',
    tmode: '20ft Truck',
    borderPort: 'Erlian (Erenhot)',
    quotationDate: '',
    validityDate: '',
    include: '',
    exclude: '',
    comment: '',
    remark: '',
  });

  const CLIENT_OPTIONS = [
    'Erdenet Mining Corporation',
    'Oyu Tolgoi LLC',
    'MAK LLC',
    'Tavan Tolgoi JSC',
    'APU JSC',
    'Unitel',
    'Gerege Systems',
    'MCS Coca-Cola',
  ];
  const CITY_OPTIONS = [
    'Ulaanbaatar, Mongolia',
    'Darkhan, Mongolia',
    'Erdenet, Mongolia',
    'Zamyn-Uud Border',
    'Tianjin Port, China',
    'Qingdao Port, China',
    'Shanghai Port, China',
  ];
  const DIVISIONS = ['import', 'export', 'transit'];
  const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP'];
  const PAYMENT_TYPES = ['Prepaid', 'Collect'];
  const TMODES = ['20ft Truck', '40ft Truck', '20ft Container', '40ft Container', 'Car Carrier'];
  const BORDER_PORTS = ['Erlian (Erenhot)', 'Zamyn-Uud', 'Tianjin Port', 'Qingdao Port'];

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

  // Load draft for quick form
  useEffect(() => {
    try {
      let raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        const legacy =
          localStorage.getItem('quotation_quick_form_draft_v1') ||
          localStorage.getItem('quotation_new_form_draft_v1');
        if (legacy) {
          raw = legacy;
          localStorage.setItem(DRAFT_KEY, raw);
          localStorage.removeItem('quotation_quick_form_draft_v1');
          localStorage.removeItem('quotation_new_form_draft_v1');
        }
      }
      if (raw) {
        const draft = JSON.parse(raw);
        const src = (draft as any).form ?? draft;
        setForm((prev) => ({ ...prev, ...src }));
      }
    } catch {}
  }, []);

  // Autosave draft
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form }));
    } catch {}
  }, [form]);

  // Load saved columns
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          order: string[];
          visibility: Record<string, boolean>;
        };
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
        division: form.division,
        incoterm: form.incoterm,
        paymentType: form.paymentType,
        tmode: form.tmode,
        borderPort: form.borderPort,
        quotationDate: form.quotationDate,
        validityDate: form.validityDate,
        include: form.include,
        exclude: form.exclude,
        comment: form.comment,
        remark: form.remark,
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
        setForm({
          client: '',
          cargoType: '',
          origin: '',
          destination: '',
          weight: '',
          volume: '',
          estimatedCost: '',
          division: 'import',
          incoterm: 'EXW',
          paymentType: 'Prepaid',
          tmode: '20ft Truck',
          borderPort: 'Erlian (Erenhot)',
          quotationDate: '',
          validityDate: '',
          include: '',
          exclude: '',
          comment: '',
          remark: '',
        });
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem('quotation_quick_form_draft_v1');
        localStorage.removeItem('quotation_new_form_draft_v1');
        toast.success('Quotation created');
      } else {
        const msg = json?.error || 'Failed to create';
        toast.error(msg);
      }
    } catch (e) {
      toast.error('Create quotation error');
    }
  };

  const columns: ColumnDef<Quotation>[] = useQuotationColumns();

  // Build current column IDs from definitions
  const allColumnIds = columns
    .map((c) => (c as any).id || (c as any).accessorKey)
    .filter(Boolean) as string[];
  const mergedOrder = columnOrder.length
    ? [...columnOrder, ...allColumnIds.filter((id) => !columnOrder.includes(id))]
    : allColumnIds;
  const listIds = mergedOrder;

  // Materialize ordered columns if a saved order exists
  const orderedColumns = columnOrder.length
    ? (mergedOrder
        .map((id) => columns.find((c) => ((c as any).id || (c as any).accessorKey) === id))
        .filter(Boolean) as ColumnDef<Quotation>[])
    : columns;

  // Initial visibility from saved settings
  const initialVisibility = Object.keys(columnVisibility).length ? columnVisibility : undefined;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('quotations.title')}</h1>
          <p className="text-gray-600">{t('quotations.subtitle')}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <div className="relative min-w-[260px] flex-1">
            <Input
              placeholder={t('quotations.search.placeholder')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8"
            />
            <span className="pointer-events-none absolute top-2.5 left-2 text-gray-400">🔎</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
              {t('quotations.filters')}
            </Button>
            <Button variant="outline" onClick={() => setShowColumnManager((v) => !v)}>
              Columns
            </Button>
            <Button variant="outline" onClick={() => setShowDrafts(true)}>
              {t('drafts.title') || 'Drafts'}
            </Button>
            <Button
              onClick={() => setShowNewQuotationForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('quotations.new')}
            </Button>
          </div>
        </div>
        <DraftsModal
          open={showDrafts}
          onClose={() => setShowDrafts(false)}
          onLoadQuick={(d: QuotationDraft) => {
            const src = d.data?.form ?? d.data;
            if (src) setForm((prev) => ({ ...prev, ...src }));
            setShowDrafts(false);
          }}
          onOpenFull={(d: QuotationDraft) => {
            // Persist into shared draft key and navigate to full form
            try {
              localStorage.setItem('quotation_draft_v1', JSON.stringify(d.data));
            } catch {}
            window.location.href = '/dashboard/quotations/new';
          }}
        />
      </div>

      <ColumnManagerModal
        open={showColumnManager}
        onClose={() => {
          setShowColumnManager(false);
          setTableKey((k) => k + 1);
        }}
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
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Quotation</CardTitle>
              <CardDescription>Enter quotation details for freight services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="client">Client</Label>
                  <ComboBox
                    value={form.client}
                    onChange={(v) => setForm({ ...form, client: v })}
                    options={CLIENT_OPTIONS}
                    placeholder="Start typing..."
                  />
                </div>
                <div>
                  <Label htmlFor="cargoType">Cargo Type</Label>
                  <Input
                    id="cargoType"
                    placeholder="e.g., Copper Concentrate"
                    value={form.cargoType}
                    onChange={(e) => setForm({ ...form, cargoType: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="origin">Origin</Label>
                  <ComboBox
                    value={form.origin}
                    onChange={(v) => setForm({ ...form, origin: v })}
                    options={CITY_OPTIONS}
                    placeholder="Search city/port..."
                  />
                </div>
                <div>
                  <Label htmlFor="destination">Destination</Label>
                  <ComboBox
                    value={form.destination}
                    onChange={(v) => setForm({ ...form, destination: v })}
                    options={CITY_OPTIONS}
                    placeholder="Search city/port..."
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="25000"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="volume">Volume (m³)</Label>
                  <Input
                    id="volume"
                    type="number"
                    step="0.1"
                    placeholder="45.5"
                    value={form.volume}
                    onChange={(e) => setForm({ ...form, volume: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="estimatedCost">Estimated Cost (USD)</Label>
                  <Input
                    id="estimatedCost"
                    type="number"
                    placeholder="12000"
                    value={form.estimatedCost}
                    onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Division</Label>
                  <Select
                    value={form.division}
                    onValueChange={(v) => setForm({ ...form, division: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Division" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIVISIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Incoterm</Label>
                  <Select
                    value={form.incoterm}
                    onValueChange={(v) => setForm({ ...form, incoterm: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Incoterm" />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment</Label>
                  <Select
                    value={form.paymentType}
                    onValueChange={(v) => setForm({ ...form, paymentType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Payment" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select value={form.tmode} onValueChange={(v) => setForm({ ...form, tmode: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {TMODES.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Border/Port</Label>
                  <Select
                    value={form.borderPort}
                    onValueChange={(v) => setForm({ ...form, borderPort: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Border/Port" />
                    </SelectTrigger>
                    <SelectContent>
                      {BORDER_PORTS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quotationDate">Quotation Date</Label>
                  <Input
                    id="quotationDate"
                    type="date"
                    value={form.quotationDate}
                    onChange={(e) => setForm({ ...form, quotationDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="validityDate">Validity</Label>
                  <Input
                    id="validityDate"
                    type="date"
                    value={form.validityDate}
                    onChange={(e) => setForm({ ...form, validityDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="include">Include</Label>
                  <textarea
                    id="include"
                    className="min-h-[80px] w-full rounded-md border p-2"
                    value={form.include}
                    onChange={(e) => setForm({ ...form, include: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="exclude">Exclude</Label>
                  <textarea
                    id="exclude"
                    className="min-h-[80px] w-full rounded-md border p-2"
                    value={form.exclude}
                    onChange={(e) => setForm({ ...form, exclude: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="comment">Comment</Label>
                  <textarea
                    id="comment"
                    className="min-h-[80px] w-full rounded-md border p-2"
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="remark">Remark</Label>
                  <textarea
                    id="remark"
                    className="min-h-[80px] w-full rounded-md border p-2"
                    value={form.remark}
                    onChange={(e) => setForm({ ...form, remark: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowNewQuotationForm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem(DRAFT_KEY);
                    localStorage.removeItem('quotation_quick_form_draft_v1');
                    localStorage.removeItem('quotation_new_form_draft_v1');
                    setForm({
                      client: '',
                      cargoType: '',
                      origin: '',
                      destination: '',
                      weight: '',
                      volume: '',
                      estimatedCost: '',
                      division: 'import',
                      incoterm: 'EXW',
                      paymentType: 'Prepaid',
                      tmode: '20ft Truck',
                      borderPort: 'Erlian (Erenhot)',
                      quotationDate: '',
                      validityDate: '',
                      include: '',
                      exclude: '',
                      comment: '',
                      remark: '',
                    });
                    toast.message('Draft cleared');
                  }}
                >
                  Clear Draft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    addDraft({ form });
                    toast.success('Draft saved');
                    setShowDrafts(true);
                  }}
                >
                  Save as Draft
                </Button>
                <Button onClick={submitNewQuotation}>Create Quotation</Button>
                <a
                  href="/dashboard/quotations/new"
                  className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
                >
                  Open Full Form
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
