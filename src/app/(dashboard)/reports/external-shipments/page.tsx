'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const CATEGORY_LABELS = {
  IMPORT: 'Import',
  TRANSIT: 'Transit',
  EXPORT: 'Export',
} as const;

type ShipmentCategoryKey = keyof typeof CATEGORY_LABELS;

type ExternalShipmentsTotals = {
  shipmentCount: number;
  amountBreakdown: Record<string, number>;
  profitMnt: number;
  profitFxBreakdown: Record<string, number>;
  categoryCounts: Record<ShipmentCategoryKey, number>;
};

type ExternalShipmentsSalesEntry = {
  key: string;
  name: string;
  shipmentCount: number;
  amountBreakdown: Record<string, number>;
  profitMnt: number;
  profitFxBreakdown: Record<string, number>;
  categoryCounts: Record<ShipmentCategoryKey, number>;
  firstShipmentAt: string | null;
  lastShipmentAt: string | null;
};

type ExternalShipmentsResponseData = {
  range: { start: string; end: string };
  filters: {
    categories: ShipmentCategoryKey[];
    filterTypes: number[];
    search: string | null;
  };
  totals: ExternalShipmentsTotals;
  sales: ExternalShipmentsSalesEntry[];
};

type ExternalShipmentsResponseBody = {
  success: boolean;
  data: ExternalShipmentsResponseData;
  error?: string;
};

type ExternalShipmentDetailItem = {
  id: string;
  externalId: string | null;
  category: ShipmentCategoryKey;
  filterType: number | null;
  customerName: string | null;
  totalAmount: number | null;
  currencyCode: string | null;
  profitMnt: number | null;
  profitCurrency: number | null;
  salesManager: string | null;
  manager: string | null;
  syncedAt: string | null;
  registeredAt: string | null;
  arrivalAt: string | null;
  transitEntryAt: string | null;
};

type ExternalShipmentDetailResponse = {
  success: boolean;
  data: {
    salesKey: string;
    salesName: string;
    items: ExternalShipmentDetailItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  MNT: '₮',
  USD: '$',
  EUR: '€',
  CNY: '¥',
  JPY: '¥',
  GBP: '£',
  RUB: '₽',
  KRW: '₩',
  AUD: 'A$',
  CAD: 'C$',
};

const DETAIL_PAGE_SIZE = 15;

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCurrencyAmount(amount: number, currency?: string | null) {
  if (!Number.isFinite(amount)) return '0';
  if (!currency) {
    return formatNumber(amount, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  }
  const code = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  const formatted = formatNumber(amount, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return symbol ? `${symbol}${formatted}` : `${code} ${formatted}`;
}

function formatRangeDisplay(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

function pickPrimaryAmount(breakdown?: Record<string, number>, preferred?: string | null) {
  if (!breakdown) return null;
  const entries = Object.entries(breakdown).filter(([, amount]) => Number.isFinite(amount));
  if (!entries.length) return null;
  const normalizedPreferred = preferred?.toUpperCase();
  if (normalizedPreferred) {
    const preferredMatch = entries.find(
      ([currency]) => currency.toUpperCase() === normalizedPreferred,
    );
    if (preferredMatch) {
      return { currency: normalizedPreferred, amount: preferredMatch[1] };
    }
  }
  const mntMatch = entries.find(([currency]) => currency.toUpperCase() === 'MNT');
  if (mntMatch) {
    return { currency: 'MNT', amount: mntMatch[1] };
  }
  const [fallbackCurrency, fallbackAmount] = entries[0];
  return { currency: fallbackCurrency.toUpperCase(), amount: fallbackAmount };
}

function formatDateTime(value: string | null, formatter: Intl.DateTimeFormat) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatter.format(date);
}

export default function ExternalShipmentsKPIPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = useMemo(() => normalizeRole(session?.user?.role), [session?.user?.role]);
  const canAccessReports = hasPermission(role, 'accessReports');

  const [data, setData] = useState<ExternalShipmentsResponseData | null>(null);
  const [currentRange, setCurrentRange] = useState<{ start: string; end: string } | null>(null);
  const [pendingRange, setPendingRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [detailData, setDetailData] = useState<ExternalShipmentDetailResponse['data'] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedSales, setSelectedSales] = useState<ExternalShipmentsSalesEntry | null>(null);
  const detailRequestIdRef = useRef(0);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  const fetchShipments = useCallback(async (range?: { start?: string; end?: string }) => {
    const params = new URLSearchParams();
    if (range?.start) params.set('start', range.start);
    if (range?.end) params.set('end', range.end);

    const query = params.toString();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/external-shipments${query ? `?${query}` : ''}`, {
        cache: 'no-store',
      });

      let body: ExternalShipmentsResponseBody | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok || !body?.success) {
        const message = body?.error ?? 'Unable to load external shipment KPIs.';
        throw new Error(message);
      }

      setData(body.data);
      setCurrentRange(body.data.range);
      setPendingRange(body.data.range);
    } catch (err: any) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(err?.message ?? 'Unable to load external shipment KPIs.');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const fetchSalesDetail = useCallback(
    async (salesKey: string, page: number) => {
      const params = new URLSearchParams();
      if (currentRange?.start) params.set('start', currentRange.start);
      if (currentRange?.end) params.set('end', currentRange.end);
      params.set('salesKey', salesKey);
      params.set('page', `${page}`);
      params.set('pageSize', `${DETAIL_PAGE_SIZE}`);

      const requestId = detailRequestIdRef.current + 1;
      detailRequestIdRef.current = requestId;

      setDetailLoading(true);
      setDetailError(null);

      try {
        const response = await fetch(`/api/reports/external-shipments?${params.toString()}`, {
          cache: 'no-store',
        });

        let body: ExternalShipmentDetailResponse | null = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }

        if (requestId !== detailRequestIdRef.current) {
          return;
        }

        if (!response.ok || !body?.success) {
          const message = body?.error ?? 'Unable to load sales shipment details.';
          throw new Error(message);
        }

        setDetailData(body.data);
      } catch (err: any) {
        if (requestId !== detailRequestIdRef.current) {
          return;
        }
        setDetailError(err?.message ?? 'Unable to load sales shipment details.');
      } finally {
        if (requestId === detailRequestIdRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [currentRange?.end, currentRange?.start],
  );

  useEffect(() => {
    if (status === 'loading') return;
    if (!canAccessReports) {
      router.replace('/dashboard');
      return;
    }
    fetchShipments();
  }, [status, canAccessReports, fetchShipments, router]);

  useEffect(() => {
    if (!detailOpen || !selectedSales) return;
    fetchSalesDetail(selectedSales.key, detailPage);
  }, [detailOpen, selectedSales, detailPage, fetchSalesDetail]);

  const filteredSales = useMemo(() => {
    if (!data?.sales?.length) return [] as ExternalShipmentsSalesEntry[];
    const term = search.trim().toLowerCase();
    if (!term) return data.sales;
    return data.sales.filter((entry) => entry.name.toLowerCase().includes(term));
  }, [data?.sales, search]);

  const revenuePrimary = useMemo(() => {
    if (!data?.totals?.amountBreakdown) return null;
    return pickPrimaryAmount(data.totals.amountBreakdown, null);
  }, [data?.totals?.amountBreakdown]);

  const profitFxEntries = useMemo(() => {
    if (!data?.totals?.profitFxBreakdown) return [] as Array<[string, number]>;
    return Object.entries(data.totals.profitFxBreakdown)
      .filter(([, amount]) => Number.isFinite(amount))
      .sort((a, b) => b[1] - a[1]);
  }, [data?.totals?.profitFxBreakdown]);

  const categorySummary = useMemo(() => {
    const counts = data?.totals?.categoryCounts;
    if (!counts) return [] as Array<{ key: ShipmentCategoryKey; value: number }>;
    return (Object.keys(CATEGORY_LABELS) as ShipmentCategoryKey[])
      .map((key) => ({ key, value: counts[key] ?? 0 }))
      .filter((item) => item.value > 0);
  }, [data?.totals?.categoryCounts]);

  const rangeDisplay = useMemo(() => {
    if (!currentRange) return null;
    return formatRangeDisplay(currentRange.start, currentRange.end);
  }, [currentRange]);

  const handleApplyRange = () => {
    if (isLoading) return;
    const start = pendingRange.start?.trim();
    const end = pendingRange.end?.trim();
    fetchShipments({ start: start || undefined, end: end || undefined });
  };

  const handleResetRange = () => {
    if (isLoading) return;
    setPendingRange({ start: '', end: '' });
    fetchShipments();
  };

  const handleOpenDetails = (entry: ExternalShipmentsSalesEntry) => {
    setSelectedSales(entry);
    setDetailPage(1);
    setDetailData(null);
    setDetailError(null);
    setDetailOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailOpen(false);
    setDetailData(null);
    setDetailError(null);
    setSelectedSales(null);
  };

  const handleDetailPageChange = (direction: 'prev' | 'next') => {
    if (!detailData) return;
    if (direction === 'prev' && detailData.pagination.page > 1) {
      setDetailPage(detailData.pagination.page - 1);
    }
    if (direction === 'next' && detailData.pagination.page < detailData.pagination.totalPages) {
      setDetailPage(detailData.pagination.page + 1);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">
        Loading external shipment KPIs…
      </div>
    );
  }

  if (!canAccessReports) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">External Shipments KPI</h1>
          <p className="text-gray-600">
            Sales-level shipment counts, revenue, and profit with drill-down into individual runs.
          </p>
          {rangeDisplay ? (
            <p className="text-sm text-gray-500">Current range: {rangeDisplay}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/reports')}>
            Back to Reports
          </Button>
          <Button onClick={() => fetchShipments(currentRange ?? undefined)} disabled={isLoading}>
            <Loader2 className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : 'hidden'}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Snapshot of the selected period. Adjust dates below to explore different intervals.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Total shipments
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(data?.totals?.shipmentCount ?? 0)}
              </p>
              {categorySummary.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {categorySummary.map((item) => (
                    <Badge key={item.key} variant="secondary">
                      {CATEGORY_LABELS[item.key]} · {formatNumber(item.value)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No shipments recorded for this range.</p>
              )}
            </div>
            <div className="rounded-md border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Revenue &amp; profit
              </p>
              <div className="space-y-1">
                <p className="text-sm text-gray-800">
                  Revenue{' '}
                  {revenuePrimary
                    ? formatCurrencyAmount(revenuePrimary.amount, revenuePrimary.currency)
                    : formatNumber(0)}
                </p>
                <p className="text-sm text-gray-800">
                  Profit ₮{formatNumber(data?.totals?.profitMnt ?? 0)}
                </p>
              </div>
              {profitFxEntries.length ? (
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  <p className="font-semibold">Profit (FX)</p>
                  {profitFxEntries.map(([currency, amount]) => (
                    <div key={currency} className="flex items-center justify-between">
                      <span>{currency.toUpperCase()}</span>
                      <span>{formatCurrencyAmount(amount, currency)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid gap-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="shipments-start-date">
                Start date
              </label>
              <Input
                id="shipments-start-date"
                type="date"
                value={pendingRange.start}
                onChange={(event) =>
                  setPendingRange((prev) => ({ ...prev, start: event.target.value }))
                }
                max={pendingRange.end || undefined}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="shipments-end-date">
                End date
              </label>
              <Input
                id="shipments-end-date"
                type="date"
                value={pendingRange.end}
                onChange={(event) =>
                  setPendingRange((prev) => ({ ...prev, end: event.target.value }))
                }
                min={pendingRange.start || undefined}
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" onClick={handleResetRange} disabled={isLoading}>
                Reset
              </Button>
              <Button onClick={handleApplyRange} disabled={isLoading}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Sales overview</CardTitle>
            <CardDescription>
              Filter by salesperson name and open the detail view to inspect individual shipments.
            </CardDescription>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search sales owner"
              className="pl-8"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales owner</TableHead>
                  <TableHead>Shipments</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Profit ₮</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>First shipment</TableHead>
                  <TableHead>Last shipment</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-gray-500">
                      <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> Loading…
                    </TableCell>
                  </TableRow>
                ) : null}

                {!isLoading && !filteredSales.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-gray-500">
                      No sales data for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : null}

                {filteredSales.map((entry) => {
                  const revenue = pickPrimaryAmount(
                    entry.amountBreakdown,
                    revenuePrimary?.currency,
                  );
                  const categoryBadges = (Object.keys(CATEGORY_LABELS) as ShipmentCategoryKey[])
                    .map((key) => ({ key, value: entry.categoryCounts[key] ?? 0 }))
                    .filter((item) => item.value > 0);

                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>{formatNumber(entry.shipmentCount)}</TableCell>
                      <TableCell>
                        {revenue ? formatCurrencyAmount(revenue.amount, revenue.currency) : '—'}
                      </TableCell>
                      <TableCell>₮{formatNumber(entry.profitMnt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {categoryBadges.length
                            ? categoryBadges.map((item) => (
                                <Badge key={item.key} variant="outline">
                                  {CATEGORY_LABELS[item.key]} · {formatNumber(item.value)}
                                </Badge>
                              ))
                            : '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDateTime(entry.firstShipmentAt, dateTimeFormatter)}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(entry.lastShipmentAt, dateTimeFormatter)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDetails(entry)}
                        >
                          View details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={detailOpen}
        onOpenChange={(next) => (next ? setDetailOpen(true) : handleCloseDetails())}
      >
        <DialogContent className="w-[90vw] max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {detailData?.salesName ?? selectedSales?.name ?? 'Sales details'}
            </DialogTitle>
            <DialogDescription>
              Shipment history for the selected salesperson. Use the controls below to navigate
              pages.
            </DialogDescription>
          </DialogHeader>

          {detailError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {detailError}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>External ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Filter</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Profit ₮</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Transit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-gray-500">
                      <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> Loading…
                    </TableCell>
                  </TableRow>
                ) : null}

                {!detailLoading && !detailData?.items.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-gray-500">
                      No shipments found for this salesperson in the selected range.
                    </TableCell>
                  </TableRow>
                ) : null}

                {detailData?.items.map((shipment) => (
                  <TableRow key={shipment.id}>
                    <TableCell>{shipment.externalId ?? '—'}</TableCell>
                    <TableCell>{CATEGORY_LABELS[shipment.category]}</TableCell>
                    <TableCell>{shipment.filterType ?? '—'}</TableCell>
                    <TableCell>{shipment.customerName ?? '—'}</TableCell>
                    <TableCell>
                      {shipment.totalAmount != null
                        ? formatCurrencyAmount(shipment.totalAmount, shipment.currencyCode)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {shipment.profitMnt != null ? `₮${formatNumber(shipment.profitMnt)}` : '—'}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(shipment.registeredAt, dateTimeFormatter)}
                    </TableCell>
                    <TableCell>{formatDateTime(shipment.arrivalAt, dateTimeFormatter)}</TableCell>
                    <TableCell>
                      {formatDateTime(shipment.transitEntryAt, dateTimeFormatter)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-gray-500">
              Page {detailData?.pagination.page ?? detailPage} of{' '}
              {detailData?.pagination.totalPages ?? '—'} · {detailData?.pagination.total ?? 0}{' '}
              shipments total
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDetailPageChange('prev')}
                disabled={detailLoading || !detailData || detailData.pagination.page <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDetailPageChange('next')}
                disabled={
                  detailLoading ||
                  !detailData ||
                  detailData.pagination.page >= detailData.pagination.totalPages
                }
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
