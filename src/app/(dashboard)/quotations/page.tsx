'use client';

import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
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

import { Badge } from '@/components/ui/badge';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLookup } from '@/components/lookup/hooks';

// Quotation type is extracted to src/types/quotation.ts

import { useSession } from 'next-auth/react';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { useRouter, useSearchParams } from 'next/navigation';

type StatusKey =
  | 'CANCELLED'
  | 'CREATED'
  | 'QUOTATION'
  | 'CONFIRMED'
  | 'ONGOING'
  | 'ARRIVED'
  | 'RELEASED'
  | 'CLOSED';

const STATUS_KEYS: StatusKey[] = [
  'CANCELLED',
  'CREATED',
  'QUOTATION',
  'CONFIRMED',
  'ONGOING',
  'ARRIVED',
  'RELEASED',
  'CLOSED',
];

const FALLBACK_CLIENT_OPTIONS = [
  'Erdenet Mining Corporation',
  'Oyu Tolgoi LLC',
  'MAK LLC',
  'Tavan Tolgoi JSC',
  'APU JSC',
  'Unitel',
  'Gerege Systems',
  'MCS Coca-Cola',
];

const FALLBACK_CITY_OPTIONS = [
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
const TMODES = ['20ft Truck', '40ft Truck', '20ft Container', '40ft Container', 'Car Carrier'];

type QuotationsResponse = {
  success: boolean;
  data: Quotation[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export default function QuotationsPage() {
  const t = useT();
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [showNewQuotationForm, setShowNewQuotationForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey | null>(null);
  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get('page') ?? '1');
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });

  const role = normalizeRole(session?.user?.role);
  const canManageQuotations = hasPermission(role, 'manageQuotations');
  const canViewAllQuotations = hasPermission(role, 'viewAllQuotations');

  // Persisted column settings
  const userKey = session?.user?.email ?? 'guest';
  const STORAGE_KEY_V1 = `quotation_table_columns_v1:${userKey}`;
  const LAYOUT_KEY_V2 = `quotation_table_layout_v2:${userKey}`;

  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [tableKey, setTableKey] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const deferredSearch = useDeferredValue(searchValue.trim());

  const pageSize = 25;

  const quotationsQuery = useQuery<QuotationsResponse>({
    queryKey: [
      'quotations',
      { page, pageSize, search: deferredSearch || undefined, status: statusFilter || undefined },
    ],
    queryFn: async (): Promise<QuotationsResponse> => {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('pageSize', String(pageSize));
      if (deferredSearch) qs.set('search', deferredSearch);
      if (statusFilter) qs.set('status', statusFilter);
      const res = await fetch(`/api/quotations?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error || 'Failed to load quotations');
      }
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const { data: quotationsResponse, isLoading, isFetching, isError, error } = quotationsQuery;

  const quotations = quotationsResponse?.data ?? [];
  const pagination = quotationsResponse?.pagination;
  const totalRows = pagination?.total ?? quotations.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / (pagination?.pageSize ?? pageSize)));

  const { data: customersLookup, isLoading: customersLoading } = useLookup('customer');
  const { data: portsLookup, isLoading: portsLoading } = useLookup('port');
  const { data: countriesLookup, isLoading: countriesLoading } = useLookup('country', {
    include: 'code',
  });

  const customerOptions = useMemo(() => {
    const options = (customersLookup?.data || [])
      .map((c) => c.name)
      .filter((name): name is string => Boolean(name));
    return options.length ? options : FALLBACK_CLIENT_OPTIONS;
  }, [customersLookup?.data]);

  const portOptions = useMemo(() => {
    const options = (portsLookup?.data || [])
      .map((p) => p.name)
      .filter((name): name is string => Boolean(name));
    return options.length ? options : FALLBACK_CITY_OPTIONS;
  }, [portsLookup?.data]);

  const countryOptions = useMemo(() => {
    const options = (countriesLookup?.data || [])
      .map((c) => (c.code ? `${c.name} (${c.code})` : c.name))
      .filter((name): name is string => Boolean(name));
    return options.length ? options : FALLBACK_CITY_OPTIONS;
  }, [countriesLookup?.data]);

  const applyStatusFilter = (status: StatusKey | null) => {
    setStatusFilter(status);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set('status', status);
    else params.delete('status');
    params.set('page', '1');
    const query = params.toString();
    router.replace(`/quotations${query ? `?${query}` : ''}`);
  };

  // New form state
  const DRAFT_KEY = 'quotation_draft_v1';
  const QUICK_FORM_DEFAULT = {
    client: '',
    cargoType: '',
    originCountry: '',
    originCity: '',
    borderPort: '',
    destinationCountry: '',
    destinationCity: '',
    estimatedCost: '',
    division: 'import',
    incoterm: 'EXW',
    paymentType: 'Prepaid',
    tmode: '20ft Truck',
    quotationDate: '',
    validityDate: '',
    comment: '',
  };
  const [form, setForm] = useState({ ...QUICK_FORM_DEFAULT });
  const [creatingQuick, setCreatingQuick] = useState(false);

  useEffect(() => {
    const param = searchParams.get('status');
    if (param && STATUS_KEYS.includes(param as StatusKey)) {
      setStatusFilter(param as StatusKey);
    } else {
      setStatusFilter(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const searchParam = searchParams.get('search') ?? '';
    setSearchValue((prev) => (prev === searchParam ? prev : searchParam));
  }, [searchParams]);

  useEffect(() => {
    const pageParam = Number(searchParams.get('page') ?? '1');
    const normalized = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    setPage((prev) => (prev === normalized ? prev : normalized));
  }, [searchParams]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set('search', value);
      else params.delete('search');
      params.set('page', '1');
      setPage(1);
      const query = params.toString();
      router.replace(`/quotations${query ? `?${query}` : ''}`);
    },
    [router, searchParams],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const normalized = Math.min(Math.max(1, nextPage), totalPages || 1);
      if (normalized === page) return;
      setPage(normalized);
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(normalized));
      const query = params.toString();
      router.replace(`/quotations${query ? `?${query}` : ''}`);
    },
    [page, router, searchParams, totalPages],
  );

  useEffect(() => {
    if (!isError || !(error instanceof Error)) return;
    toast.error(error.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, error?.message]);

  useEffect(() => {
    if (!canManageQuotations) {
      setShowNewQuotationForm(false);
    }
  }, [canManageQuotations]);

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
      // Prefer v2 unified layout if present
      const rawV2 = localStorage.getItem(LAYOUT_KEY_V2);
      if (rawV2) {
        const layout = JSON.parse(rawV2) as Record<string, { order: number; visible: boolean }>;
        const entries = Object.entries(layout).sort((a, b) => a[1].order - b[1].order);
        setColumnOrder(entries.map(([id]) => id));
        const vis: Record<string, boolean> = {};
        for (const [id, cfg] of entries) vis[id] = cfg.visible !== false;
        setColumnVisibility(vis);
        return;
      }
      // Fall back to v1 and migrate to v2 for future
      const saved = localStorage.getItem(STORAGE_KEY_V1);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          order?: string[];
          visibility?: Record<string, boolean>;
        };
        const order = parsed.order ?? [];
        const visibility = parsed.visibility ?? {};
        setColumnOrder(order);
        setColumnVisibility(visibility);
        try {
          const layout: Record<string, { order: number; visible: boolean }> = {};
          order.forEach((id, idx) => {
            layout[id] = { order: idx, visible: visibility[id] !== false };
          });
          if (Object.keys(layout).length > 0) {
            localStorage.setItem(LAYOUT_KEY_V2, JSON.stringify(layout));
          }
        } catch {}
      }
    } catch {}
  }, [STORAGE_KEY_V1, LAYOUT_KEY_V2]);

  const submitNewQuotation = async () => {
    setCreatingQuick(true);
    try {
      if (!canManageQuotations) {
        toast.error('You do not have permission to create quotations.');
        setCreatingQuick(false);
        return;
      }

      const requiredFields: Array<[keyof typeof form, string]> = [
        ['client', 'Client'],
        ['cargoType', 'Cargo Type'],
        ['originCountry', 'Origin Country'],
        ['originCity', 'Origin City'],
        ['borderPort', 'Border / Port'],
        ['destinationCountry', 'Destination Country'],
        ['destinationCity', 'Destination City'],
        ['division', 'Division'],
        ['incoterm', 'Incoterm'],
        ['paymentType', 'Payment Type'],
        ['tmode', 'Transport Mode'],
        ['quotationDate', 'Quotation Date'],
        ['validityDate', 'Validity Date'],
      ];

      const missingLabels: string[] = [];
      requiredFields.forEach(([key, label]) => {
        const value = form[key];
        if (!value || !String(value).trim()) {
          missingLabels.push(label);
        }
      });

      const estimatedCostNumber = Number(form.estimatedCost);
      if (!Number.isFinite(estimatedCostNumber) || estimatedCostNumber <= 0) {
        missingLabels.push('Estimated Cost');
      }

      if (missingLabels.length) {
        toast.error(`Fill required fields: ${missingLabels.join(', ')}`);
        setCreatingQuick(false);
        return;
      }

      const payload = {
        client: form.client.trim(),
        cargoType: form.cargoType.trim(),
        originCountry: form.originCountry.trim(),
        originCity: form.originCity.trim(),
        destinationCountry: form.destinationCountry.trim(),
        destinationCity: form.destinationCity.trim(),
        borderPort: form.borderPort.trim(),
        estimatedCost: estimatedCostNumber,
        division: form.division,
        incoterm: form.incoterm,
        paymentType: form.paymentType,
        tmode: form.tmode,
        quotationDate: form.quotationDate,
        validityDate: form.validityDate,
        comment: form.comment,
        origin: form.originCity || form.originCountry,
        destination: form.destinationCity || form.destinationCountry,
      };
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json?.data) {
        await queryClient.invalidateQueries({ queryKey: ['quotations'] });
        setShowNewQuotationForm(false);
        setForm({ ...QUICK_FORM_DEFAULT });
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem('quotation_quick_form_draft_v1');
        localStorage.removeItem('quotation_new_form_draft_v1');
        toast.success('Quotation created');
      } else {
        const msg = json?.error || 'Failed to create';
        toast.error(msg);
      }
    } catch (error) {
      console.error('Create quotation error', error);
      toast.error('Create quotation error');
    }
    setCreatingQuick(false);
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

  // Filter columns by current visibility (non-hideable columns are always visible)
  const filteredColumns = (orderedColumns as any[]).filter((def) => {
    const id = (def.id || def.accessorKey) as string | undefined;
    if (!id) return true;
    if (def.enableHiding === false) return true;
    const v = columnVisibility[id];
    return v !== false;
  }) as ColumnDef<Quotation>[];

  // Also build a VisibilityState map for the internal DataTable to ensure it hides columns too
  const tableVisibilityState = useMemo(() => {
    const vis: Record<string, boolean> = {};
    (columns as any[]).forEach((def) => {
      const id = (def.id || def.accessorKey) as string | undefined;
      if (!id) return;
      if (def.enableHiding === false) vis[id] = true;
      else vis[id] = columnVisibility[id] !== false;
    });
    return vis;
  }, [columns, columnVisibility]);

  const statusLabels: Record<StatusKey, string> = {
    CANCELLED: t('status.cancelled'),
    CREATED: t('status.created'),
    QUOTATION: t('status.quotation'),
    CONFIRMED: t('status.confirmed'),
    ONGOING: t('status.ongoing'),
    ARRIVED: t('status.arrived'),
    RELEASED: t('status.released'),
    CLOSED: t('status.closed'),
  };

  const filteredQuotations = quotations;
  const showSkeleton = isLoading && !quotations.length;
  const showEmptyState = !isLoading && quotations.length === 0;

  return (
    <div className="space-y-1.5 px-2 sm:px-4 md:space-y-2 md:px-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{t('quotations.title')}</h1>
          <p className="text-sm text-gray-600 sm:text-base">{t('quotations.subtitle')}</p>
          {!canViewAllQuotations && (
            <p className="text-xs text-amber-600 sm:text-sm">
              You can view and manage only the quotations assigned to you.
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2">
          <div className="relative w-full">
            <Input
              placeholder={t('quotations.search.placeholder')}
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8"
            />
            <span className="pointer-events-none absolute top-2.5 left-2 text-gray-400">🔎</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters((v) => !v)}
              className="flex-1 sm:flex-none"
            >
              {t('quotations.filters')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowColumnManager((v) => !v)}
              className="flex-1 sm:flex-none"
            >
              Columns
            </Button>
            {canManageQuotations && (
              <Button
                variant="outline"
                onClick={() => setShowDrafts(true)}
                className="flex-1 sm:flex-none"
              >
                {t('drafts.title') || 'Drafts'}
              </Button>
            )}
            {canManageQuotations && (
              <Button
                onClick={() => setShowNewQuotationForm(true)}
                className="flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                {t('quotations.new')}
              </Button>
            )}
          </div>
        </div>
        {statusFilter && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{t('quotations.statusFilter.activePrefix')}</span>
            <Badge variant="secondary">{statusLabels[statusFilter]}</Badge>
            <Button variant="ghost" size="sm" onClick={() => applyStatusFilter(null)}>
              {t('quotations.statusFilter.clear')}
            </Button>
          </div>
        )}
        {canManageQuotations && (
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
              window.location.href = '/quotations/new';
            }}
          />
        )}
      </div>

      <ColumnManagerModal
        open={showColumnManager}
        onClose={() => {
          // Persist latest order/visibility on close
          try {
            localStorage.setItem(
              STORAGE_KEY_V1,
              JSON.stringify({ order: listIds, visibility: columnVisibility }),
            );
            // Also persist unified v2 layout
            const layout: Record<string, { order: number; visible: boolean }> = {};
            listIds.forEach((id, idx) => {
              const defAny: any = columns.find((c: any) => (c.id || c.accessorKey) === id);
              const alwaysOn = defAny?.enableHiding === false;
              const visible = alwaysOn ? true : columnVisibility[id] !== false;
              layout[id] = { order: idx, visible };
            });
            localStorage.setItem(LAYOUT_KEY_V2, JSON.stringify(layout));
          } catch {}
          setShowColumnManager(false);
          setTableKey((k) => k + 1);
        }}
        onSave={({ order, visibility }) => {
          setColumnOrder(order);
          setColumnVisibility(visibility);
          try {
            localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ order, visibility }));
            // Also persist unified v2 layout
            const layout: Record<string, { order: number; visible: boolean }> = {};
            order.forEach((id, idx) => {
              const defAny: any = columns.find((c: any) => (c.id || c.accessorKey) === id);
              const alwaysOn = defAny?.enableHiding === false;
              const visible = alwaysOn ? true : visibility[id] !== false;
              layout[id] = { order: idx, visible };
            });
            localStorage.setItem(LAYOUT_KEY_V2, JSON.stringify(layout));
          } catch {}
          setTableKey((k) => k + 1);
        }}
        allColumns={columns}
        order={mergedOrder}
        setOrder={(next) => setColumnOrder(next)}
        visibility={columnVisibility}
        setVisibility={(next) => setColumnVisibility(next)}
        storageKey={STORAGE_KEY_V1}
        layoutKeyV2={LAYOUT_KEY_V2}
      />

      {/* Filters Panel */}
      {showFilters && <FiltersPanel />}

      {/* Data Table */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">{t('quotations.table.all')}</CardTitle>
            <CardDescription className="text-sm">
              {isLoading
                ? t('quotations.table.loading')
                : isFetching
                  ? t('common.loading')
                  : t('quotations.table.desc')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && !isLoading && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('common.loading')}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['quotations'] })}
              disabled={isLoading}
              className="inline-flex items-center gap-1"
            >
              <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0 sm:p-2">
          {isError && error instanceof Error ? (
            <div className="p-4">
              <Alert variant="destructive" className="gap-y-3">
                <AlertCircle />
                <AlertTitle>{t('quotations.toast.loadFailed')}</AlertTitle>
                <AlertDescription className="w-full">
                  <p>{error.message}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['quotations'] })}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                {showSkeleton ? (
                  <div className="min-w-[800px] p-4">
                    <QuotationTableSkeleton rows={8} />
                  </div>
                ) : (
                  <div className="min-w-[800px] p-2 sm:p-0">
                    {showEmptyState ? (
                      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center text-sm">
                        <p>No quotations found.</p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              queryClient.invalidateQueries({ queryKey: ['quotations'] })
                            }
                          >
                            <RefreshCcw className="h-4 w-4" />
                            <span className="ml-1">Refresh</span>
                          </Button>
                          {canManageQuotations && (
                            <Button size="sm" onClick={() => setShowNewQuotationForm(true)}>
                              <Plus className="h-4 w-4" />
                              <span className="ml-1">{t('quotations.new')}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <DataTable
                        key={tableKey}
                        columns={filteredColumns}
                        data={filteredQuotations}
                        hideColumnVisibilityMenu={true}
                        enableRowReordering={false}
                        enableColumnReordering={true}
                        enableColumnVisibility={true}
                        initialColumnVisibility={tableVisibilityState}
                        enablePagination={false}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="text-muted-foreground flex flex-col gap-2 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
                <div>
                  {totalRows > 0
                    ? `Total ${totalRows} • Page ${page} / ${totalPages}`
                    : 'No records to display'}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1 || isLoading}
                    className="inline-flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </Button>
                  <span className="text-xs font-medium text-gray-600 sm:text-sm">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages || isLoading}
                    className="inline-flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* New Quotation Modal */}
      {canManageQuotations && showNewQuotationForm && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Quotation</CardTitle>
              <CardDescription>Enter quotation details for freight services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="quick-client">Client</Label>
                  <ComboBox
                    value={form.client}
                    onChange={(v) => setForm({ ...form, client: v })}
                    options={customerOptions}
                    isLoading={customersLoading}
                    placeholder="Start typing..."
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="quick-cargo">Cargo Type</Label>
                  <Input
                    id="quick-cargo"
                    placeholder="e.g., Copper Concentrate"
                    value={form.cargoType}
                    onChange={(e) => setForm({ ...form, cargoType: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="quick-estimated-cost">Estimated Cost (USD)</Label>
                  <Input
                    id="quick-estimated-cost"
                    type="number"
                    placeholder="12000"
                    value={form.estimatedCost}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label>Division</Label>
                  <Select
                    value={form.division}
                    onValueChange={(v) => setForm({ ...form, division: v })}
                  >
                    <SelectTrigger className="w-full">
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
                    <SelectTrigger className="w-full">
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
                  <Label>Transport Mode</Label>
                  <Select value={form.tmode} onValueChange={(v) => setForm({ ...form, tmode: v })}>
                    <SelectTrigger className="w-full">
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
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="quick-origin-country">Origin Country</Label>
                      <ComboBox
                        value={form.originCountry}
                        onChange={(v) => setForm({ ...form, originCountry: v })}
                        options={countryOptions}
                        isLoading={countriesLoading}
                        placeholder="Search country..."
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quick-origin-city">Origin City/Port</Label>
                      <ComboBox
                        value={form.originCity}
                        onChange={(v) => setForm({ ...form, originCity: v })}
                        options={portOptions}
                        isLoading={portsLoading}
                        placeholder="Search city/port..."
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="quick-border">Border / Port</Label>
                  <ComboBox
                    value={form.borderPort}
                    onChange={(v) => setForm({ ...form, borderPort: v })}
                    options={portOptions}
                    isLoading={portsLoading}
                    placeholder="Select border or port"
                    className="w-full"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="quick-destination-country">Destination Country</Label>
                      <ComboBox
                        value={form.destinationCountry}
                        onChange={(v) => setForm({ ...form, destinationCountry: v })}
                        options={countryOptions}
                        isLoading={countriesLoading}
                        placeholder="Search country..."
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quick-destination-city">Destination City/Port</Label>
                      <ComboBox
                        value={form.destinationCity}
                        onChange={(v) => setForm({ ...form, destinationCity: v })}
                        options={portOptions}
                        isLoading={portsLoading}
                        placeholder="Search city/port..."
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="quick-quotation-date">Quotation Date</Label>
                      <Input
                        id="quick-quotation-date"
                        type="date"
                        value={form.quotationDate}
                        onChange={(e) => setForm({ ...form, quotationDate: e.target.value })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quick-validity-date">Validity Date</Label>
                      <Input
                        id="quick-validity-date"
                        type="date"
                        value={form.validityDate}
                        onChange={(e) => setForm({ ...form, validityDate: e.target.value })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="quick-comment">Comment</Label>
                  <textarea
                    id="quick-comment"
                    className="min-h-[80px] w-full rounded-md border p-2"
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
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
                    setForm({ ...QUICK_FORM_DEFAULT });
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
                <Button
                  onClick={submitNewQuotation}
                  disabled={creatingQuick}
                  className="inline-flex items-center gap-2"
                >
                  {creatingQuick && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Quotation
                </Button>
                <a
                  href="/quotations/new"
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

function QuotationTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="bg-muted/10 grid grid-cols-[1.2fr,1fr,1fr,0.8fr,0.8fr] gap-3 rounded-md border border-transparent p-3"
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
