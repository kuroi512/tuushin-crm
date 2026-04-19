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
import { Quotation } from '@/types/quotation';
import { ComboBox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
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
import {
  AlertCircle,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Loader2,
  RefreshCcw,
  Truck,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLookup } from '@/components/lookup/hooks';

// Quotation type is extracted to src/types/quotation.ts

import { useSession } from 'next-auth/react';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { useRouter, useSearchParams } from 'next/navigation';

/** Four list modes aligned with UI (see API `qf`). */
type QuotationFilterPreset = 'all' | 'approved' | 'closed' | 'new';

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
const TMODES = ['20ft Truck', '40ft Truck', '20ft Container', '40ft Container', 'Car Carrier'];

function parseQuotationFilterFromSearch(searchParams: { get: (name: string) => string | null }) {
  const raw = searchParams.get('qf');
  if (raw === 'approved' || raw === 'closed' || raw === 'new' || raw === 'all') {
    return raw;
  }
  return 'all';
}

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
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [quotationFilter, setQuotationFilter] = useState<QuotationFilterPreset>(() =>
    parseQuotationFilterFromSearch(searchParams),
  );
  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get('page') ?? '1');
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });

  const role = normalizeRole(session?.user?.role);
  const canManageQuotations = hasPermission(role, 'manageQuotations');
  const canViewAllQuotations = hasPermission(role, 'viewAllQuotations');

  // Persisted column settings
  const userKey =
    session?.user?.id ?? (session?.user?.email ? session.user.email.trim().toLowerCase() : 'guest');
  const STORAGE_KEY_V1 = `quotation_table_columns_v1:${userKey}`;
  const LAYOUT_KEY_V2 = `quotation_table_layout_v2:${userKey}`;

  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [tableKey, setTableKey] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [pageInput, setPageInput] = useState('1');
  const deferredSearch = useDeferredValue(searchValue.trim());

  const pageSize = 15;

  const quotationsQuery = useQuery<QuotationsResponse>({
    queryKey: [
      'quotations',
      {
        page,
        pageSize,
        search: deferredSearch || undefined,
        qf: quotationFilter,
      },
    ],
    queryFn: async (): Promise<QuotationsResponse> => {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('pageSize', String(pageSize));
      if (deferredSearch) qs.set('search', deferredSearch);
      qs.set('qf', quotationFilter);
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
  const { data: incotermsLookup, isLoading: incotermsLoading } = useLookup('incoterm');

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

  const incotermOptions = useMemo(() => {
    const options = (incotermsLookup?.data || [])
      .map((option) => option.name)
      .filter((name): name is string => Boolean(name));
    return options;
  }, [incotermsLookup?.data]);

  const applyQuotationFilter = useCallback(
    (next: QuotationFilterPreset) => {
      setQuotationFilter(next);
      setPage(1);
      const params = new URLSearchParams();
      const s = searchParams.get('search')?.trim();
      if (s) params.set('search', s);
      params.set('qf', next);
      params.set('page', '1');
      router.replace(`/quotations?${params.toString()}`);
    },
    [router, searchParams],
  );

  // New form state

  const buildQuickOffers = (f: any) => {
    const rate = Number(f?.estimatedCost);
    const safeRate = Number.isFinite(rate) ? rate : undefined;
    const uuid =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    return [
      {
        id: uuid,
        title: 'Offer 1',
        order: 0,
        offerNumber: undefined,
        transportMode: f?.tmode || '',
        borderPort: f?.borderPort || undefined,
        incoterm: f?.incoterm || undefined,
        shipper: f?.shipper || undefined,
        terminal: f?.terminal || undefined,
        transitTime: undefined,
        rate: safeRate,
        rateCurrency: f?.currency || 'USD',
        grossWeight: undefined,
        dimensionsCbm: undefined,
        notes: undefined,
      },
    ];
  };

  const buildQuickDraftPayload = (f: any) => ({
    form: f,
    offers: buildQuickOffers(f),
  });
  const QUICK_FORM_DEFAULT = {
    client: '',
    originIncoterm: '',
    destinationIncoterm: '',
    originCountry: '',
    originCity: '',
    borderPort: '',
    destinationCountry: 'Mongolia',
    destinationCity: 'Ulaanbaatar',
    estimatedCost: '',
    currency: 'USD',
    division: 'import',
    tmode: '20ft Truck',
    quotationDate: '',
    validityDate: '',
    comment: '',
  };
  const [form, setForm] = useState({ ...QUICK_FORM_DEFAULT });
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [creatingQuick, setCreatingQuick] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const searchParam = searchParams.get('search') ?? '';
    setSearchValue((prev) => (prev === searchParam ? prev : searchParam));
  }, [searchParams]);

  useEffect(() => {
    const next = parseQuotationFilterFromSearch(searchParams);
    setQuotationFilter((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  useEffect(() => {
    const pageParam = Number(searchParams.get('page') ?? '1');
    const normalized = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    setPage((prev) => (prev === normalized ? prev : normalized));
  }, [searchParams]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      const params = new URLSearchParams();
      if (value.trim()) params.set('search', value.trim());
      params.set('qf', quotationFilter);
      params.set('page', '1');
      setPage(1);
      router.replace(`/quotations?${params.toString()}`);
    },
    [router, quotationFilter],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const normalized = Math.min(Math.max(1, nextPage), totalPages || 1);
      if (normalized === page) return;
      setPage(normalized);
      const params = new URLSearchParams();
      const s = searchParams.get('search')?.trim();
      if (s) params.set('search', s);
      params.set('qf', quotationFilter);
      params.set('page', String(normalized));
      router.replace(`/quotations?${params.toString()}`);
    },
    [page, quotationFilter, router, searchParams, totalPages],
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
        toast.error(t('quotations.quickModal.toast.permissionDenied'));
        setCreatingQuick(false);
        return;
      }

      const requiredFields: Array<[keyof typeof form, string]> = [
        ['client', 'quotations.quickModal.errors.required.client'],
        ['originCountry', 'quotations.quickModal.errors.required.originCountry'],
        ['originCity', 'quotations.quickModal.errors.required.originCity'],
        ['borderPort', 'quotations.quickModal.errors.required.borderPort'],
        ['destinationCountry', 'quotations.quickModal.errors.required.destinationCountry'],
        ['destinationCity', 'quotations.quickModal.errors.required.destinationCity'],
        ['division', 'quotations.quickModal.errors.required.division'],
        ['tmode', 'quotations.quickModal.errors.required.tmode'],
        ['quotationDate', 'quotations.quickModal.errors.required.quotationDate'],
        ['validityDate', 'quotations.quickModal.errors.required.validityDate'],
      ];

      const newErrors: Record<string, string> = {};
      requiredFields.forEach(([key, errKey]) => {
        const value = form[key];
        if (!value || !String(value).trim()) {
          newErrors[key] = t(errKey);
        }
      });

      const estimatedCostNumber = Number(form.estimatedCost);
      if (!Number.isFinite(estimatedCostNumber) || estimatedCostNumber <= 0) {
        newErrors['estimatedCost'] = t('quotations.quickModal.errors.offerRatePositive');
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        toast.error(t('quotations.quickModal.toast.requiredFields'));
        setCreatingQuick(false);
        return;
      }

      setErrors({});

      // Create first offer with the estimated cost
      const firstOffer = {
        order: 0,
        transportMode: form.tmode,
        rate: estimatedCostNumber,
        rateCurrency: form.currency,
        profit: {
          amount: estimatedCostNumber,
          currency: form.currency,
        },
      };

      const payload = {
        client: form.client.trim(),
        cargoType: form.tmode.trim(),
        originCountry: form.originCountry.trim(),
        originCity: form.originCity.trim(),
        destinationCountry: form.destinationCountry.trim(),
        destinationCity: form.destinationCity.trim(),
        borderPort: form.borderPort.trim(),
        estimatedCost: estimatedCostNumber,
        division: form.division,
        tmode: form.tmode,
        quotationDate: form.quotationDate,
        validityDate: form.validityDate,
        comment: form.comment,
        origin: form.originCity || form.originCountry,
        destination: form.destinationCity || form.destinationCountry,
        originIncoterm: form.originIncoterm,
        destinationIncoterm: form.destinationIncoterm,
        incoterm: form.originIncoterm,
        draftId: activeDraftId || undefined,
        offers: [firstOffer],
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
        setActiveDraftId(null);
        toast.success(t('quotations.quickModal.toast.created'));
      } else {
        const msg = json?.error || t('quotations.quickModal.toast.createFailed');
        toast.error(msg);
      }
    } catch (error) {
      console.error('Create quotation error', error);
      toast.error(t('quotations.quickModal.toast.createError'));
    }
    setCreatingQuick(false);
  };

  const { columns, dialog: closeReasonDialog } = useQuotationColumns();

  // Build current column IDs from definitions
  const allColumnIds = useMemo(
    () => columns.map((c) => (c as any).id || (c as any).accessorKey).filter(Boolean) as string[],
    [columns],
  );
  const mergedOrder = useMemo(
    () =>
      columnOrder.length
        ? [...columnOrder, ...allColumnIds.filter((id) => !columnOrder.includes(id))]
        : allColumnIds,
    [columnOrder, allColumnIds],
  );
  const listIds = mergedOrder;

  const persistColumnLayout = useCallback(
    (order: string[], visibility: Record<string, boolean>) => {
      try {
        localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ order, visibility }));
        const layout: Record<string, { order: number; visible: boolean }> = {};
        order.forEach((id, idx) => {
          const defAny: any = columns.find((c: any) => (c.id || c.accessorKey) === id);
          const alwaysOn = defAny?.enableHiding === false;
          const visible = alwaysOn ? true : visibility[id] !== false;
          layout[id] = { order: idx, visible };
        });
        localStorage.setItem(LAYOUT_KEY_V2, JSON.stringify(layout));
      } catch {}
    },
    [STORAGE_KEY_V1, LAYOUT_KEY_V2, columns],
  );

  // Materialize ordered columns if a saved order exists (memoized for stable reference)
  const orderedColumns = useMemo(
    () =>
      columnOrder.length
        ? (mergedOrder
            .map((id) => columns.find((c) => ((c as any).id || (c as any).accessorKey) === id))
            .filter(Boolean) as ColumnDef<Quotation>[])
        : columns,
    [columnOrder, mergedOrder, columns],
  );

  // Filter columns by current visibility (non-hideable columns are always visible)
  const filteredColumns = useMemo(
    () =>
      (orderedColumns as any[]).filter((def) => {
        const id = (def.id || def.accessorKey) as string | undefined;
        if (!id) return true;
        if (def.enableHiding === false) return true;
        const v = columnVisibility[id];
        return v !== false;
      }) as ColumnDef<Quotation>[],
    [orderedColumns, columnVisibility],
  );

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

  const filteredQuotations = quotations;
  const showSkeleton = isLoading && !quotations.length;
  const showEmptyState = !isLoading && quotations.length === 0;

  return (
    <>
      <div className="space-y-1.5 px-2 sm:px-4 md:space-y-2 md:px-6">
        {/* Page Header */}
        <div className="flex flex-col gap-1.5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{t('quotations.title')}</h1>
            <p className="text-sm text-gray-600 sm:text-base">{t('quotations.subtitle')}</p>
            {!canViewAllQuotations && (
              <p className="text-xs text-amber-600 sm:text-sm">
                {t('quotations.permission.scopeSelf')}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={t('quotations.filter.groupLabel')}
              >
                {(['all', 'approved', 'closed', 'new'] as const).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant={quotationFilter === key ? 'secondary' : 'outline'}
                    size="sm"
                    className="shrink-0"
                    onClick={() => applyQuotationFilter(key)}
                  >
                    {t(`quotations.filter.${key}`)}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowColumnManager((v) => !v)}
                  className="flex-1 sm:flex-none"
                >
                  {t('table.columns')}
                </Button>
                {canManageQuotations && (
                  <Button
                    variant="outline"
                    onClick={() => setShowDrafts(true)}
                    className="flex-1 sm:flex-none"
                  >
                    {t('drafts.title')}
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
          </div>
          {quotationFilter !== 'all' && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span>{t('quotations.statusFilter.activePrefix')}</span>
              <Badge variant="secondary">{t(`quotations.filter.${quotationFilter}`)}</Badge>
              <Button variant="ghost" size="sm" onClick={() => applyQuotationFilter('all')}>
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
                if (src) {
                  setForm((prev) => ({ ...prev, ...src }));
                  setActiveDraftId(d.id);
                }
                setShowDrafts(false);
              }}
              onOpenFull={(d: QuotationDraft) => {
                window.location.href = `/quotations/new?draftId=${encodeURIComponent(d.id)}`;
              }}
            />
          )}
        </div>

        <ColumnManagerModal
          open={showColumnManager}
          onClose={() => {
            setShowColumnManager(false);
            setTableKey((k) => k + 1);
          }}
          onSave={({ order, visibility }) => {
            setColumnOrder(order);
            setColumnVisibility(visibility);
            persistColumnLayout(order, visibility);
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
                <span className="hidden sm:inline">{t('common.refresh')}</span>
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
                      {t('common.retry')}
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
                          <p>{t('quotations.empty')}</p>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                queryClient.invalidateQueries({ queryKey: ['quotations'] })
                              }
                            >
                              <RefreshCcw className="h-4 w-4" />
                              <span className="ml-1">{t('common.refresh')}</span>
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
                          onColumnReorder={(nextColumns) => {
                            const visibleOrder = nextColumns
                              .map((c: any) => c.id || c.accessorKey)
                              .filter(Boolean) as string[];
                            const nextOrder = [
                              ...visibleOrder,
                              ...mergedOrder.filter((id) => !visibleOrder.includes(id)),
                            ];
                            setColumnOrder(nextOrder);
                            persistColumnLayout(nextOrder, columnVisibility);
                          }}
                          enablePagination={false}
                        />
                      )}
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground flex flex-col gap-2 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
                  <div>
                    {totalRows > 0
                      ? `${t('quotations.pagination.total')} ${totalRows} • ${t('quotations.pagination.page')} ${page} / ${totalPages}`
                      : t('quotations.pagination.noRecords')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/master/external-shipments')}
                      className="inline-flex items-center gap-1"
                    >
                      <Truck className="h-4 w-4" />
                      <span>{t('quotations.shipmentsLink')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={page <= 1 || isLoading}
                      className="inline-flex items-center gap-1"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('quotations.pagination.first')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1 || isLoading}
                      className="inline-flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('quotations.pagination.prev')}</span>
                    </Button>
                    <span className="text-xs font-medium text-gray-600 sm:text-sm">
                      {page} / {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">
                        {t('quotations.pagination.goTo')}
                      </span>
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          const target = Number(pageInput || '1');
                          if (!Number.isFinite(target)) return;
                          handlePageChange(target);
                        }}
                        className="h-8 w-16"
                        aria-label={t('quotations.pagination.goToPageAria')}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages || isLoading}
                      className="inline-flex items-center gap-1"
                    >
                      <span className="hidden sm:inline">{t('quotations.pagination.next')}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={page >= totalPages || isLoading}
                      className="inline-flex items-center gap-1"
                    >
                      <span className="hidden sm:inline">{t('quotations.pagination.last')}</span>
                      <ChevronsRight className="h-4 w-4" />
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
                <CardTitle>{t('quotations.quickModal.title')}</CardTitle>
                <CardDescription>{t('quotations.quickModal.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label htmlFor="quick-client">{t('quotations.quickModal.client')}</Label>
                    <ComboBox
                      value={form.client}
                      onChange={(v) => {
                        setForm({ ...form, client: v });
                        if (errors.client) setErrors({ ...errors, client: '' });
                      }}
                      options={customerOptions}
                      isLoading={customersLoading}
                      placeholder={t('quotations.quickModal.placeholder.startTyping')}
                      className="w-full"
                    />
                    {errors.client && <p className="mt-1 text-sm text-red-600">{errors.client}</p>}
                  </div>
                  <div>
                    <Label>{t('quotations.quickModal.division')}</Label>
                    <Select
                      value={form.division}
                      onValueChange={(v) => setForm({ ...form, division: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t('quotations.quickModal.placeholder.division')}
                        />
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
                    <Label>{t('quotations.quickModal.transportMode')}</Label>
                    <Select
                      value={form.tmode}
                      onValueChange={(v) => setForm({ ...form, tmode: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('quotations.quickModal.placeholder.mode')} />
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
                    <Label htmlFor="quick-estimated-cost">
                      {t('quotations.quickModal.offerRate')}
                    </Label>
                    <Input
                      id="quick-estimated-cost"
                      type="number"
                      placeholder="12000"
                      value={form.estimatedCost}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        setForm({ ...form, estimatedCost: e.target.value });
                        if (errors.estimatedCost) setErrors({ ...errors, estimatedCost: '' });
                      }}
                      className="w-full"
                    />
                    {errors.estimatedCost && (
                      <p className="mt-1 text-sm text-red-600">{errors.estimatedCost}</p>
                    )}
                  </div>
                  <div>
                    <Label>{t('quotations.quickModal.currency')}</Label>
                    <Select
                      value={form.currency}
                      onValueChange={(v) => setForm({ ...form, currency: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t('quotations.quickModal.placeholder.currency')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                        <SelectItem value="MNT">MNT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label>{t('quotations.quickModal.originIncoterm')}</Label>
                        <Select
                          value={form.originIncoterm}
                          onValueChange={(v) => setForm({ ...form, originIncoterm: v })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                incotermsLoading
                                  ? t('quotations.quickModal.placeholder.loading')
                                  : t('quotations.quickModal.placeholder.selectIncoterm')
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {incotermOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="quick-origin-country">
                          {t('quotations.quickModal.originCountry')}
                        </Label>
                        <ComboBox
                          value={form.originCountry}
                          onChange={(v) => {
                            setForm({ ...form, originCountry: v });
                            if (errors.originCountry) setErrors({ ...errors, originCountry: '' });
                          }}
                          options={countryOptions}
                          isLoading={countriesLoading}
                          placeholder={t('quotations.quickModal.placeholder.searchCountry')}
                          className="w-full"
                        />
                        {errors.originCountry && (
                          <p className="mt-1 text-sm text-red-600">{errors.originCountry}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="quick-origin-city">
                          {t('quotations.quickModal.originCity')}
                        </Label>
                        <ComboBox
                          value={form.originCity}
                          onChange={(v) => {
                            setForm({ ...form, originCity: v });
                            if (errors.originCity) setErrors({ ...errors, originCity: '' });
                          }}
                          options={portOptions}
                          isLoading={portsLoading}
                          placeholder={t('quotations.quickModal.placeholder.searchCityPort')}
                          className="w-full"
                        />
                        {errors.originCity && (
                          <p className="mt-1 text-sm text-red-600">{errors.originCity}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="quick-border">{t('quotations.quickModal.transitPort')}</Label>
                    <ComboBox
                      value={form.borderPort}
                      onChange={(v) => {
                        setForm({ ...form, borderPort: v });
                        if (errors.borderPort) setErrors({ ...errors, borderPort: '' });
                      }}
                      options={portOptions}
                      isLoading={portsLoading}
                      placeholder={t('quotations.quickModal.placeholder.selectTransitPort')}
                      className="w-full"
                    />
                    {errors.borderPort && (
                      <p className="mt-1 text-sm text-red-600">{errors.borderPort}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label>{t('quotations.quickModal.destinationIncoterm')}</Label>
                        <Select
                          value={form.destinationIncoterm}
                          onValueChange={(v) => setForm({ ...form, destinationIncoterm: v })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                incotermsLoading
                                  ? t('quotations.quickModal.placeholder.loading')
                                  : t('quotations.quickModal.placeholder.selectIncoterm')
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {incotermOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="quick-destination-country">
                          {t('quotations.quickModal.destinationCountry')}
                        </Label>
                        <ComboBox
                          value={form.destinationCountry}
                          onChange={(v) => {
                            setForm({ ...form, destinationCountry: v });
                            if (errors.destinationCountry)
                              setErrors({ ...errors, destinationCountry: '' });
                          }}
                          options={countryOptions}
                          isLoading={countriesLoading}
                          placeholder={t('quotations.quickModal.placeholder.searchCountry')}
                          className="w-full"
                        />
                        {errors.destinationCountry && (
                          <p className="mt-1 text-sm text-red-600">{errors.destinationCountry}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="quick-destination-city">
                          {t('quotations.quickModal.destinationCity')}
                        </Label>
                        <ComboBox
                          value={form.destinationCity}
                          onChange={(v) => {
                            setForm({ ...form, destinationCity: v });
                            if (errors.destinationCity)
                              setErrors({ ...errors, destinationCity: '' });
                          }}
                          options={portOptions}
                          isLoading={portsLoading}
                          placeholder={t('quotations.quickModal.placeholder.searchCityPort')}
                          className="w-full"
                        />
                        {errors.destinationCity && (
                          <p className="mt-1 text-sm text-red-600">{errors.destinationCity}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="quick-quotation-date">
                          {t('quotations.quickModal.quotationDate')}
                        </Label>
                        <DatePicker
                          id="quick-quotation-date"
                          value={form.quotationDate}
                          onChange={(v) => {
                            const date = new Date(v + 'T00:00:00');
                            date.setDate(date.getDate() + 7);
                            const validityDate = date.toISOString().split('T')[0];
                            setForm((prev) => ({
                              ...prev,
                              quotationDate: v,
                              validityDate: prev.validityDate || validityDate,
                            }));
                            if (errors.quotationDate) setErrors({ ...errors, quotationDate: '' });
                          }}
                          placeholder={t('quotations.quickModal.placeholder.selectQuotationDate')}
                        />
                        {errors.quotationDate && (
                          <p className="mt-1 text-sm text-red-600">{errors.quotationDate}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="quick-validity-date">
                          {t('quotations.quickModal.validityDate')}
                        </Label>
                        <DatePicker
                          id="quick-validity-date"
                          value={form.validityDate}
                          onChange={(v) => {
                            setForm({ ...form, validityDate: v });
                            if (errors.validityDate) setErrors({ ...errors, validityDate: '' });
                          }}
                          placeholder={t('quotations.quickModal.placeholder.selectValidityDate')}
                          minDate={form.quotationDate || undefined}
                        />
                        {errors.validityDate && (
                          <p className="mt-1 text-sm text-red-600">{errors.validityDate}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="quick-comment">{t('quotations.quickModal.comment')}</Label>
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
                    {t('quotations.quickModal.cancel')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm({ ...QUICK_FORM_DEFAULT });
                      setActiveDraftId(null);
                      toast.message(t('quotations.quickModal.toast.draftCleared'));
                    }}
                  >
                    {t('quotations.quickModal.clearDraft')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const payload = buildQuickDraftPayload(form);
                      const result = await addDraft(payload, undefined, activeDraftId || undefined);
                      if (result) {
                        setActiveDraftId(result.id);
                        toast.success(t('quotations.quickModal.toast.draftSaved'));
                        setShowDrafts(true);
                      } else {
                        toast.error(t('quotations.quickModal.toast.draftSaveFailed'));
                      }
                    }}
                  >
                    {t('quotations.quickModal.saveDraft')}
                  </Button>
                  <Button
                    onClick={submitNewQuotation}
                    disabled={creatingQuick}
                    className="inline-flex items-center gap-2"
                  >
                    {creatingQuick && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('quotations.quickModal.create')}
                  </Button>
                  <a
                    href="/quotations/new"
                    onClick={async (e) => {
                      e.preventDefault();
                      let draftId = activeDraftId;

                      if (!draftId) {
                        const payload = buildQuickDraftPayload(form);
                        const draft = await addDraft(payload);
                        if (!draft) {
                          toast.error(t('quotations.quickModal.toast.openFullDraftFailed'));
                          return;
                        }
                        draftId = draft.id;
                        setActiveDraftId(draftId);
                      }

                      window.location.href = `/quotations/new?draftId=${encodeURIComponent(draftId)}`;
                    }}
                    className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
                  >
                    {t('quotations.quickModal.openFullForm')}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      {closeReasonDialog}
    </>
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
