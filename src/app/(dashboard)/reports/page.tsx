'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend as BarLegend,
  LabelList,
} from 'recharts';
import { BarChart3, ExternalLink, Filter, Maximize2, Users, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { hasPermission, normalizeRole } from '@/lib/permissions';
import { useT } from '@/lib/i18n';
import { LegacyQuotationSections } from '@/components/reports/legacy-quotation-sections';
import {
  YtdSalesTransmodeMatrixTable,
  type YtdSalesTransmodeMatrixData,
} from '@/components/reports/ytd-sales-transmode-matrix-table';
import {
  SalesTransmodePeriodDetailTable,
  type SalesTransmodePeriodMatrixPayload,
} from '@/components/reports/sales-transmode-period-detail-table';
import {
  ImportRegistrationBySalesTables,
  type ImportRegistrationBySalesPayload,
} from '@/components/reports/import-registration-by-sales-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SalesEntry {
  key: string;
  name: string;
  shipmentCount: number;
  teuCount?: number;
}

interface TransmodeEntry {
  name: string;
  shipmentCount: number;
}

interface ReportsResponseData {
  sales: SalesEntry[];
  range: { start: string; end: string };
  totals: { shipmentCount: number };
  pagination: { totalPages: number; page: number };
}

interface ReportsResponseBody {
  success: boolean;
  data: ReportsResponseData;
  error?: string;
}

interface TransmodeReportsResponseData {
  transmodes: TransmodeEntry[];
  range: { start: string; end: string };
  pagination: { totalPages: number; page: number };
}

interface TransmodeReportsResponseBody {
  success: boolean;
  data: TransmodeReportsResponseData;
  error?: string;
}

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatTeuBarLabel(raw: number) {
  if (!Number.isFinite(raw)) return '';
  const rounded = Math.round(raw * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded));
  return String(rounded);
}

function formatRangeDisplay(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Monday–Sunday in UTC, matching the report date pickers. */
function getCurrentWeekRangeUtcMondaySunday() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const todayUtc = new Date(Date.UTC(y, m, d));
  const wd = todayUtc.getUTCDay();
  const daysFromMonday = (wd + 6) % 7;
  const monday = new Date(todayUtc);
  monday.setUTCDate(todayUtc.getUTCDate() - daysFromMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: toDateInputValue(monday),
    end: toDateInputValue(sunday),
  };
}

function ytdRangeStrings(ref: Date, year: number) {
  const month = ref.getUTCMonth();
  const day = ref.getUTCDate();
  const lastDayInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayInMonth);
  const start = `${year}-01-01`;
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  return { start, end };
}

const PIE_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#0EA5E9', // Sky
  '#D946EF', // Fuchsia
  '#EA580C', // Bronze
  '#22C55E', // Emerald
  '#A855F7', // Violet
  '#7C3AED', // Purple-dark
  '#DC2626', // Red-dark
  '#059669', // Green-dark
  '#D97706', // Amber-dark
  '#7C2D12', // Orange-dark
  '#0369A1', // Cyan-dark
  '#BE123C', // Rose
  '#5B21B6', // Purple-darker
  '#1F2937', // Gray-dark
  '#0891B2', // Cyan-lighter
  '#7C2D12', // Brown
  '#B91C1C', // Red-darker
  '#047857', // Green-darker
  '#92400E', // Amber-darker
  '#4F46E5', // Indigo-dark
  '#06B6D4', // Cyan-bright
  '#EC4899', // Pink-bright
  '#F472B6', // Pink-light
  '#FBBF24', // Amber-light
];

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useT();
  const role = useMemo(() => normalizeRole(session?.user?.role), [session?.user?.role]);
  const canAccessReports = hasPermission(role, 'accessReports');

  const defaultRange = useMemo(() => getCurrentWeekRangeUtcMondaySunday(), []);
  const [data, setData] = useState<{
    range: { start: string; end: string };
    totalShipments: number;
    sales: SalesEntry[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [pendingRange, setPendingRange] = useState(defaultRange);
  const [currentRange, setCurrentRange] = useState<{ start: string; end: string } | null>(null);
  const requestIdRef = useRef(0);
  const [transmodes, setTransmodes] = useState<TransmodeEntry[]>([]);
  const [isTransmodeFetching, setIsTransmodeFetching] = useState(false);
  const [transmodeError, setTransmodeError] = useState<string | null>(null);
  const transmodeRequestIdRef = useRef(0);
  const [yearlyChart, setYearlyChart] = useState<{
    data: Array<Record<string, string | number>>;
    prevYear: number;
    currYear: number;
    ytdEndLabel: string;
  } | null>(null);
  const [teuChart, setTeuChart] = useState<{
    data: Array<Record<string, string | number>>;
    prevYear: number;
    currYear: number;
    grandPrev: number;
    grandCurr: number;
    growthPct: string;
  } | null>(null);
  const [importReg, setImportReg] = useState<ImportRegistrationBySalesPayload | null>(null);
  const [importRegError, setImportRegError] = useState<string | null>(null);
  const [salesMatrix, setSalesMatrix] = useState<YtdSalesTransmodeMatrixData | null>(null);
  const [salesMatrixError, setSalesMatrixError] = useState<string | null>(null);
  const [periodMatrix, setPeriodMatrix] = useState<SalesTransmodePeriodMatrixPayload | null>(null);
  const [periodMatrixError, setPeriodMatrixError] = useState<string | null>(null);
  const [periodMatrixLoading, setPeriodMatrixLoading] = useState(false);
  const [periodMatrixDialogOpen, setPeriodMatrixDialogOpen] = useState(false);
  const fetchReports = useCallback(
    async (options?: { start?: string; end?: string }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsFetching(true);
      setError(null);

      const start = options?.start?.trim() || defaultRange.start;
      const end = options?.end?.trim() || defaultRange.end;

      try {
        let page = 1;
        let totalPages = 1;
        const allSales: SalesEntry[] = [];
        let latestData: ReportsResponseData | null = null;

        while (page <= totalPages) {
          const params = new URLSearchParams({
            start,
            end,
            page: String(page),
            pageSize: '100',
          });

          const response = await fetch(`/api/reports/external-shipments?${params.toString()}`, {
            cache: 'no-store',
          });

          let body: ReportsResponseBody | null = null;
          try {
            body = await response.json();
          } catch {
            body = null;
          }

          if (!response.ok || !body?.success) {
            const message = body?.error ?? 'Unable to load reports data.';
            throw new Error(message);
          }

          latestData = body.data;
          allSales.push(...body.data.sales);
          totalPages = Math.max(body.data.pagination?.totalPages ?? 1, 1);
          page += 1;
        }

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!latestData) {
          setData({ range: { start, end }, totalShipments: 0, sales: [] });
          setCurrentRange({ start, end });
          setPendingRange({ start, end });
          return;
        }

        setData({
          range: latestData.range,
          totalShipments: latestData.totals.shipmentCount,
          sales: allSales,
        });
        setCurrentRange(latestData.range);
        setPendingRange(latestData.range);
      } catch (err: any) {
        if (requestId === requestIdRef.current) {
          setError(err?.message ?? 'Unable to load reports data.');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsFetching(false);
        }
      }
    },
    [defaultRange.end, defaultRange.start],
  );

  const fetchTransmodes = useCallback(
    async (options?: { start?: string; end?: string }) => {
      const requestId = transmodeRequestIdRef.current + 1;
      transmodeRequestIdRef.current = requestId;
      setIsTransmodeFetching(true);
      setTransmodeError(null);

      const start = options?.start?.trim() || defaultRange.start;
      const end = options?.end?.trim() || defaultRange.end;

      try {
        let page = 1;
        let totalPages = 1;
        const allTransmodes: TransmodeEntry[] = [];

        while (page <= totalPages) {
          const params = new URLSearchParams({
            start,
            end,
            page: String(page),
            pageSize: '100',
          });

          const response = await fetch(
            `/api/reports/external-shipments/by-transmode?${params.toString()}`,
            {
              cache: 'no-store',
            },
          );

          let body: TransmodeReportsResponseBody | null = null;
          try {
            body = await response.json();
          } catch {
            body = null;
          }

          if (!response.ok || !body?.success) {
            const message = body?.error ?? 'Unable to load transportation mode data.';
            throw new Error(message);
          }

          allTransmodes.push(...body.data.transmodes);
          totalPages = Math.max(body.data.pagination?.totalPages ?? 1, 1);
          page += 1;
        }

        if (requestId !== transmodeRequestIdRef.current) {
          return;
        }

        setTransmodes(allTransmodes);
      } catch (err: any) {
        if (requestId === transmodeRequestIdRef.current) {
          setTransmodeError(err?.message ?? 'Unable to load transportation mode data.');
        }
      } finally {
        if (requestId === transmodeRequestIdRef.current) {
          setIsTransmodeFetching(false);
        }
      }
    },
    [defaultRange.end, defaultRange.start],
  );

  const fetchYearlyYtdChart = useCallback(async () => {
    try {
      const ref = new Date();
      const cy = ref.getUTCFullYear();
      const py = cy - 1;
      const years = [py, cy];
      const yearlyByTransmode: Record<string, Record<number, number>> = {};

      for (const year of years) {
        const { start, end } = ytdRangeStrings(ref, year);
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
          const params = new URLSearchParams({
            start,
            end,
            page: String(page),
            pageSize: '100',
          });

          const response = await fetch(
            `/api/reports/external-shipments/by-transmode?${params.toString()}`,
            {
              cache: 'no-store',
            },
          );

          let body: TransmodeReportsResponseBody | null = null;
          try {
            body = await response.json();
          } catch {
            body = null;
          }

          if (!response.ok || !body?.success) {
            const message = body?.error ?? 'Unable to load yearly transportation mode data.';
            throw new Error(message);
          }

          body.data.transmodes.forEach((transmode) => {
            if (!yearlyByTransmode[transmode.name]) {
              yearlyByTransmode[transmode.name] = {};
            }
            yearlyByTransmode[transmode.name][year] =
              (yearlyByTransmode[transmode.name][year] || 0) + transmode.shipmentCount;
          });
          totalPages = Math.max(body.data.pagination?.totalPages ?? 1, 1);
          page += 1;
        }
      }

      const pk = String(py);
      const ck = String(cy);
      const chartData = Object.entries(yearlyByTransmode)
        .map(([name, yearCounts]) => ({
          name,
          [pk]: yearCounts[py] || 0,
          [ck]: yearCounts[cy] || 0,
        }))
        .sort(
          (a, b) =>
            Number(b[pk] ?? 0) + Number(b[ck] ?? 0) - (Number(a[pk] ?? 0) + Number(a[ck] ?? 0)),
        );

      const ytdEndLabel = formatRangeDisplay(
        ytdRangeStrings(ref, cy).start,
        ytdRangeStrings(ref, cy).end,
      );
      setYearlyChart({ data: chartData, prevYear: py, currYear: cy, ytdEndLabel });
    } catch (err) {
      console.error('Error fetching yearly data:', err);
      setYearlyChart(null);
    }
  }, []);

  const fetchTeuYtdChart = useCallback(async () => {
    try {
      const ref = new Date();
      const cy = ref.getUTCFullYear();
      const py = cy - 1;
      const years = [py, cy];
      const teuByManager: Record<string, Record<number, number>> = {};

      for (const year of years) {
        const { start, end } = ytdRangeStrings(ref, year);
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
          const params = new URLSearchParams({
            start,
            end,
            page: String(page),
            pageSize: '100',
          });

          const response = await fetch(`/api/reports/external-shipments?${params.toString()}`, {
            cache: 'no-store',
          });

          const body = await response.json();
          if (response.ok && body?.success) {
            body.data.sales.forEach((sale: { name: string; teuCount?: number }) => {
              if (!teuByManager[sale.name]) {
                teuByManager[sale.name] = {};
              }
              teuByManager[sale.name][year] =
                ((teuByManager[sale.name][year] as number) || 0) + (sale.teuCount || 0);
            });
            totalPages = Math.max(body.data.pagination?.totalPages ?? 1, 1);
          }
          page += 1;
        }
      }

      const pk = String(py);
      const ck = String(cy);
      const chartData = Object.entries(teuByManager).map(([name, yearCounts]) => ({
        name,
        [pk]: (yearCounts[py] as number) || 0,
        [ck]: (yearCounts[cy] as number) || 0,
      }));

      const grandPrev = Object.values(teuByManager).reduce(
        (s, y) => s + ((y[py] as number) || 0),
        0,
      );
      const grandCurr = Object.values(teuByManager).reduce(
        (s, y) => s + ((y[cy] as number) || 0),
        0,
      );
      const growthPct =
        grandPrev === 0 ? '—' : `${Math.round(((grandCurr - grandPrev) / grandPrev) * 100)}%`;

      setTeuChart({
        data: chartData,
        prevYear: py,
        currYear: cy,
        grandPrev,
        grandCurr,
        growthPct,
      });
    } catch (err) {
      console.error('Error fetching TEU data:', err);
      setTeuChart(null);
    }
  }, []);

  const fetchImportRegistration = useCallback(async () => {
    setImportRegError(null);
    try {
      const response = await fetch('/api/reports/external-shipments/import-registration-by-sales', {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? 'Unable to load import registration table.');
      }
      setImportReg(body.data as ImportRegistrationBySalesPayload);
    } catch (e: any) {
      setImportReg(null);
      setImportRegError(e?.message ?? 'Unable to load import registration table.');
    }
  }, []);

  const fetchSalesTransmodeMatrix = useCallback(async () => {
    setSalesMatrixError(null);
    try {
      const response = await fetch('/api/reports/external-shipments/ytd-sales-transmode-matrix', {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? 'Unable to load sales matrix.');
      }
      setSalesMatrix(body.data as YtdSalesTransmodeMatrixData);
    } catch (e: any) {
      setSalesMatrix(null);
      setSalesMatrixError(e?.message ?? 'Unable to load sales matrix.');
    }
  }, []);

  const fetchPeriodMatrix = useCallback(async (range: { start: string; end: string }) => {
    setPeriodMatrixError(null);
    setPeriodMatrixLoading(true);
    try {
      const params = new URLSearchParams({ start: range.start, end: range.end });
      const response = await fetch(
        `/api/reports/external-shipments/sales-transmode-period-matrix?${params.toString()}`,
        { cache: 'no-store' },
      );
      const body = await response.json();
      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? 'Unable to load period matrix.');
      }
      setPeriodMatrix(body.data as SalesTransmodePeriodMatrixPayload);
    } catch (e: unknown) {
      setPeriodMatrix(null);
      setPeriodMatrixError(e instanceof Error ? e.message : 'Unable to load period matrix.');
    } finally {
      setPeriodMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!canAccessReports) {
      router.replace('/dashboard');
    }
  }, [status, canAccessReports, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !canAccessReports) return;
    fetchReports({ start: defaultRange.start, end: defaultRange.end });
    fetchTransmodes({ start: defaultRange.start, end: defaultRange.end });
    fetchYearlyYtdChart();
    fetchTeuYtdChart();
    fetchImportRegistration();
    fetchSalesTransmodeMatrix();
  }, [
    status,
    canAccessReports,
    fetchReports,
    fetchTransmodes,
    fetchYearlyYtdChart,
    fetchTeuYtdChart,
    fetchImportRegistration,
    fetchSalesTransmodeMatrix,
    defaultRange.start,
    defaultRange.end,
  ]);

  useEffect(() => {
    if (
      status !== 'authenticated' ||
      !canAccessReports ||
      !currentRange?.start ||
      !currentRange?.end
    ) {
      return;
    }
    fetchPeriodMatrix(currentRange);
  }, [status, canAccessReports, currentRange, fetchPeriodMatrix]);

  const hasRangeChanges = useMemo(() => {
    if (!currentRange) {
      return Boolean(pendingRange.start || pendingRange.end);
    }
    return pendingRange.start !== currentRange.start || pendingRange.end !== currentRange.end;
  }, [pendingRange, currentRange]);

  const managerTotalCount = useMemo(
    () => data?.sales.reduce((sum, entry) => sum + (entry.shipmentCount || 0), 0) ?? 0,
    [data],
  );

  const transmodeTotalCount = useMemo(
    () => transmodes.reduce((sum, entry) => sum + (entry.shipmentCount || 0), 0),
    [transmodes],
  );

  const yearlyTotalCount = useMemo(() => {
    if (!yearlyChart?.data.length) return 0;
    const pk = String(yearlyChart.prevYear);
    const ck = String(yearlyChart.currYear);
    return yearlyChart.data.reduce(
      (sum, entry) => sum + Number(entry[pk] ?? 0) + Number(entry[ck] ?? 0),
      0,
    );
  }, [yearlyChart]);

  const teuBarChartData = useMemo(() => {
    if (!teuChart) return [];
    const pk = String(teuChart.prevYear);
    const ck = String(teuChart.currYear);
    const sorted = [...teuChart.data].sort((a, b) =>
      String(a.name).localeCompare(String(b.name), 'mn', { sensitivity: 'base' }),
    );
    return [
      ...sorted,
      {
        name: t('reports.teuComparison.totalBarLabel'),
        [pk]: teuChart.grandPrev,
        [ck]: teuChart.grandCurr,
      },
    ];
  }, [teuChart, t]);

  const rangeDisplay = useMemo(() => {
    if (currentRange?.start && currentRange?.end) {
      return formatRangeDisplay(currentRange.start, currentRange.end);
    }
    if (pendingRange.start && pendingRange.end) {
      return formatRangeDisplay(pendingRange.start, pendingRange.end);
    }
    return null;
  }, [currentRange, pendingRange.end, pendingRange.start]);

  const isInitialLoading = isFetching && !data;
  const salesChartData = useMemo(
    () =>
      (data?.sales ?? []).map((entry) => ({
        name: entry.name,
        value: entry.shipmentCount,
      })),
    [data?.sales],
  );
  const chartHasData = salesChartData.some((item) => item.value > 0);

  const transmodeChartData = useMemo(
    () =>
      transmodes.map((entry) => ({
        name: entry.name,
        value: entry.shipmentCount,
      })),
    [transmodes],
  );
  const transmodeChartHasData = transmodeChartData.some((item) => item.value > 0);

  const handleStartChange = (value: string) => {
    setPendingRange((prev) => ({ ...prev, start: value }));
  };

  const handleEndChange = (value: string) => {
    setPendingRange((prev) => ({ ...prev, end: value }));
  };

  const handleApplyFilters = () => {
    if (isFetching) return;
    if (!hasRangeChanges && data) return;
    fetchReports({
      start: pendingRange.start,
      end: pendingRange.end,
    });
    fetchTransmodes({
      start: pendingRange.start,
      end: pendingRange.end,
    });
  };

  const handleResetFilters = () => {
    if (isFetching) return;
    const fresh = getCurrentWeekRangeUtcMondaySunday();
    setPendingRange(fresh);
    fetchReports(fresh);
    fetchTransmodes(fresh);
  };

  const handleRetry = () => {
    if (isFetching) return;
    fetchReports({ start: pendingRange.start, end: pendingRange.end });
    fetchTransmodes({ start: pendingRange.start, end: pendingRange.end });
    fetchYearlyYtdChart();
    fetchTeuYtdChart();
    fetchImportRegistration();
    fetchSalesTransmodeMatrix();
    fetchPeriodMatrix({ start: pendingRange.start, end: pendingRange.end });
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">
        {t('reports.loading')}
      </div>
    );
  }

  if (!canAccessReports) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="text-gray-600">{t('reports.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full min-w-44 space-y-1 sm:w-auto">
            <p className="text-xs text-gray-500">{t('reports.dateRange.start')}</p>
            <DatePicker
              id="report-start-date"
              value={pendingRange.start}
              onChange={handleStartChange}
              maxDate={pendingRange.end || undefined}
              placeholder="Start date"
            />
          </div>
          <div className="w-full min-w-44 space-y-1 sm:w-auto">
            <p className="text-xs text-gray-500">{t('reports.dateRange.end')}</p>
            <DatePicker
              id="report-end-date"
              value={pendingRange.end}
              onChange={handleEndChange}
              minDate={pendingRange.start || undefined}
              placeholder="End date"
            />
          </div>
          <Button variant="outline" onClick={handleResetFilters} disabled={isFetching}>
            {t('reports.dateRange.reset')}
          </Button>
          <Button
            onClick={handleApplyFilters}
            disabled={isFetching || (!hasRangeChanges && Boolean(data))}
          >
            <Filter className="mr-2 h-4 w-4" />
            {t('reports.dateRange.apply')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-gray-500">
            {rangeDisplay
              ? `${t('reports.showingData')} ${rangeDisplay}`
              : 'Select a start and end date to filter the report.'}
          </p>
          {data ? (
            <p className="mt-1 text-sm font-medium text-gray-700">
              {t('reports.totalShipments.title')}: {formatNumber(data.totalShipments)}
            </p>
          ) : null}
          {isFetching && data ? (
            <p className="mt-2 text-xs text-gray-400">{t('reports.refreshing')}</p>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRetry} disabled={isFetching}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isInitialLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse text-sm text-gray-500">{t('reports.loading')}</div>
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex w-full flex-wrap items-start justify-between gap-2">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t('reports.byManager.title')}
                    <span className="text-sm font-medium text-gray-500">
                      ({formatNumber(managerTotalCount)})
                    </span>
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={periodMatrixLoading}
                    onClick={() => setPeriodMatrixDialogOpen(true)}
                  >
                    <Maximize2 className="h-4 w-4" />
                    {t('reports.periodMatrix.openModal')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-72 w-full">
                  {chartHasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesChartData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={2}
                        >
                          {salesChartData.map((entry, index) => (
                            <Cell
                              key={`${entry.name}-${index}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatNumber(value)}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                      {t('reports.byManager.noData')}
                    </div>
                  )}
                </div>
                {data.sales.length ? (
                  <div className="space-y-2">
                    {data.sales.map((entry) => (
                      <div
                        key={entry.key}
                        className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-gray-900">{entry.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600">
                            {formatNumber(entry.shipmentCount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{t('reports.byManager.noManagers')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex w-full flex-wrap items-start justify-between gap-2">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {t('reports.transmode.title')}
                    <span className="text-sm font-medium text-gray-500">
                      ({formatNumber(transmodeTotalCount)})
                    </span>
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={periodMatrixLoading}
                    onClick={() => setPeriodMatrixDialogOpen(true)}
                  >
                    <Maximize2 className="h-4 w-4" />
                    {t('reports.periodMatrix.openModal')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {transmodeError ? (
                  <p className="text-sm text-red-600">{transmodeError}</p>
                ) : isTransmodeFetching ? (
                  <p className="text-sm text-gray-500">{t('reports.transmode.loading')}</p>
                ) : transmodes.length ? (
                  <>
                    <div className="h-72 w-full">
                      {transmodeChartHasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={transmodeChartData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={50}
                              outerRadius={82}
                              paddingAngle={2}
                            >
                              {transmodeChartData.map((entry, index) => (
                                <Cell
                                  key={`${entry.name}-${index}`}
                                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => formatNumber(value)}
                              labelFormatter={(label) => `${label}`}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                          {t('reports.transmode.noData')}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {transmodes.map((entry, index) => (
                        <div
                          key={`${entry.name}-${index}`}
                          className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-gray-900">{entry.name}</p>
                          <p className="text-sm text-gray-600">
                            {formatNumber(entry.shipmentCount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">{t('reports.transmode.noData')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Dialog open={periodMatrixDialogOpen} onOpenChange={setPeriodMatrixDialogOpen}>
            <DialogContent className="max-h-[92vh] max-w-[min(96vw,1200px)] gap-0 overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="pr-8 text-base sm:text-lg">
                  {t('reports.periodMatrix.detailTitle')}
                </DialogTitle>
                <p className="text-muted-foreground text-sm">
                  {periodMatrix
                    ? formatRangeDisplay(periodMatrix.range.start, periodMatrix.range.end)
                    : currentRange
                      ? formatRangeDisplay(currentRange.start, currentRange.end)
                      : null}
                </p>
              </DialogHeader>
              <div className="mt-4 space-y-3">
                {periodMatrixLoading ? (
                  <p className="text-sm text-gray-500">{t('reports.periodMatrix.loading')}</p>
                ) : null}
                {periodMatrixError ? (
                  <p className="text-sm text-red-600">{periodMatrixError}</p>
                ) : null}
                {periodMatrix ? (
                  <SalesTransmodePeriodDetailTable
                    data={periodMatrix}
                    labels={{
                      namesColumn: t('reports.periodMatrix.namesColumn'),
                      totalColumn: t('reports.salesTransmodeMatrix.totalCol'),
                      grandTotalRow: t('reports.periodMatrix.footerGrandTotal'),
                    }}
                  />
                ) : !periodMatrixLoading && !periodMatrixError ? (
                  <p className="text-sm text-gray-500">{t('reports.periodMatrix.error')}</p>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>

          {/* Yearly comparison (YTD, same calendar window in each year) */}
          {yearlyChart && yearlyChart.data.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('reports.yearlyComparison.title')}
                  <span className="text-sm font-medium text-gray-500">
                    ({formatNumber(yearlyTotalCount)})
                  </span>
                </CardTitle>
                <p className="text-sm text-gray-500">{t('reports.yearlyComparison.ytdNote')}</p>
                <p className="text-xs text-gray-400">{yearlyChart.ytdEndLabel}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyChart.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatNumber(value)} />
                      <BarLegend />
                      <Bar
                        dataKey={String(yearlyChart.prevYear)}
                        fill="#7DD3FC"
                        name={String(yearlyChart.prevYear)}
                      />
                      <Bar
                        dataKey={String(yearlyChart.currYear)}
                        fill="#1E40AF"
                        name={String(yearlyChart.currYear)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {salesMatrixError ? (
                  <p className="text-sm text-amber-800">{salesMatrixError}</p>
                ) : null}

                {salesMatrix && salesMatrix.managers.length > 0 ? (
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-center text-sm font-semibold text-gray-900 sm:text-left">
                          {t('reports.salesTransmodeMatrix.title')}
                        </h3>
                        <p className="text-center text-xs text-gray-500 sm:text-left">
                          {salesMatrix.previousRange.start}/{salesMatrix.previousRange.end} ·{' '}
                          {salesMatrix.currentRange.start}/{salesMatrix.currentRange.end}
                        </p>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                          >
                            <Maximize2 className="h-4 w-4" />
                            {t('reports.salesTransmodeMatrix.openModal')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[92vh] max-w-[min(96vw,1400px)] gap-0 overflow-y-auto p-4 sm:p-6">
                          <DialogHeader>
                            <DialogTitle className="pr-8 text-base sm:text-lg">
                              {t('reports.salesTransmodeMatrix.title')}
                            </DialogTitle>
                            <p className="text-muted-foreground text-sm">
                              {salesMatrix.previousRange.start}/{salesMatrix.previousRange.end} ·{' '}
                              {salesMatrix.currentRange.start}/{salesMatrix.currentRange.end}
                            </p>
                          </DialogHeader>
                          <YtdSalesTransmodeMatrixTable
                            data={salesMatrix}
                            labels={{
                              modeColumn: t('reports.salesTransmodeMatrix.modeColumn'),
                              totalCol: t('reports.salesTransmodeMatrix.totalCol'),
                              growthCol: t('reports.salesTransmodeMatrix.growthCol'),
                              totalsRow: t('reports.salesTransmodeMatrix.totalsRow'),
                              teuRow: t('reports.salesTransmodeMatrix.teuRow'),
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <YtdSalesTransmodeMatrixTable
                      data={salesMatrix}
                      labels={{
                        modeColumn: t('reports.salesTransmodeMatrix.modeColumn'),
                        totalCol: t('reports.salesTransmodeMatrix.totalCol'),
                        growthCol: t('reports.salesTransmodeMatrix.growthCol'),
                        totalsRow: t('reports.salesTransmodeMatrix.totalsRow'),
                        teuRow: t('reports.salesTransmodeMatrix.teuRow'),
                      }}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {teuChart && teuChart.data.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('reports.teuComparison.chartTitle')}
                  <span className="text-sm font-medium text-gray-500">
                    ({formatTeuBarLabel(teuChart.grandCurr)} TEU)
                  </span>
                </CardTitle>
                {/* <p className="text-sm text-gray-500">{t('reports.teuComparison.ytdNote')}</p>
                <p className="text-xs text-gray-600">
                  {t('reports.teuComparison.grandLine')
                    .replace('{prev}', formatTeuBarLabel(teuChart.grandPrev))
                    .replace('{curr}', formatTeuBarLabel(teuChart.grandCurr))
                    .replace('{pct}', teuChart.growthPct)}
                </p> */}
              </CardHeader>
              <CardContent>
                <div className="h-[440px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={teuBarChartData}
                      margin={{ top: 28, right: 12, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        angle={-38}
                        textAnchor="end"
                        height={118}
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number | string) =>
                          typeof value === 'number' ? formatTeuBarLabel(value) : String(value)
                        }
                      />
                      <BarLegend />
                      <Bar
                        dataKey={String(teuChart.prevYear)}
                        fill="#86efac"
                        name={String(teuChart.prevYear)}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          dataKey={String(teuChart.prevYear)}
                          position="top"
                          formatter={(v) =>
                            typeof v === 'number' ? formatTeuBarLabel(v) : String(v ?? '')
                          }
                        />
                      </Bar>
                      <Bar
                        dataKey={String(teuChart.currYear)}
                        fill="#15803d"
                        name={String(teuChart.currYear)}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          dataKey={String(teuChart.currYear)}
                          position="top"
                          formatter={(v) =>
                            typeof v === 'number' ? formatTeuBarLabel(v) : String(v ?? '')
                          }
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {importRegError ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-800">{importRegError}</CardContent>
            </Card>
          ) : null}

          {importReg ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-center text-sm leading-snug font-semibold sm:text-base">
                  {t('reports.importRegistration.title')}
                </CardTitle>
                {/* <p className="text-center text-xs text-gray-500 sm:text-sm">
                  {t('reports.importRegistration.subtitle')}
                </p>
                <p className="text-center text-xs font-medium text-emerald-800">
                  {t('reports.importRegistration.teuYoYLine').replace(
                    '{pct}',
                    importReg.teuYoYGrowthPct,
                  )}
                </p> */}
              </CardHeader>
              <CardContent className="p-2 sm:p-6">
                {importReg.managers.length > 0 ? (
                  <ImportRegistrationBySalesTables
                    data={importReg}
                    labels={{
                      typeCol: t('reports.importRegistration.typeCol'),
                      urd: t('reports.borderImportTable.urd'),
                      hoid: t('reports.borderImportTable.hoid'),
                      totalGroup: t('reports.importRegistration.totalGroup'),
                      totalTeu: t('reports.importRegistration.totalTeuCol'),
                      footerTotal: t('reports.importRegistration.footerTotal'),
                      footerTeu: t('reports.importRegistration.footerTeu'),
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground text-center text-sm">
                    {t('reports.importRegistration.empty')}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <LegacyQuotationSections
            startDate={currentRange?.start ?? pendingRange.start}
            endDate={currentRange?.end ?? pendingRange.end}
          />
        </>
      ) : null}

      {!data && !isInitialLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">{t('reports.noDataAvailable')}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
