'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  type LucideIcon,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { hasPermission, normalizeRole } from '@/lib/permissions';

interface ReportsSummary {
  totalQuotations: number;
  offersSent: number;
  approved: number;
  approvalRate: number;
  profitBreakdown: Record<string, number>;
  totalProfit: number;
  currency: string | null;
}

interface SalesLeaderboardEntry {
  name: string;
  quotations: number;
  offersSent: number;
  approved: number;
  approvalRate: number;
  profitBreakdown: Record<string, number>;
}

interface ClientApprovalEntry {
  client: string;
  quotations: number;
  approvals: number;
  profitBreakdown: Record<string, number>;
}

interface TimelinePoint {
  key: string;
  label: string;
  quotations: number;
  offersSent: number;
  approved: number;
  profitBreakdown: Record<string, number>;
}

interface ReportsResponseData {
  summary: ReportsSummary;
  leaderboard: SalesLeaderboardEntry[];
  topClients: ClientApprovalEntry[];
  timeline: TimelinePoint[];
  range: { start: string; end: string };
  totals: {
    salesPeople: number;
    clients: number;
    approvedClients: number;
  };
}

interface ReportsResponseBody {
  success: boolean;
  data: ReportsResponseData;
  error?: string;
}

type PlaceholderReport = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const PLACEHOLDER_REPORTS: PlaceholderReport[] = [
  {
    id: 'client-insights',
    title: 'Client Insights',
    description: 'Engagement depth, retention, and expansion opportunities.',
    icon: Users,
  },
];

const CHART_METRIC_OPTIONS = [
  { value: 'profit', label: 'Profit' },
  { value: 'quotations', label: 'Quotations' },
  { value: 'offers', label: 'Offers Sent' },
  { value: 'approved', label: 'Approved' },
] as const;

const CHART_SPAN_OPTIONS = [
  { value: '4m', label: 'Last 4 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: 'ytd', label: 'Year to date' },
] as const;

type ChartMetricValue = (typeof CHART_METRIC_OPTIONS)[number]['value'];
type ChartSpanValue = (typeof CHART_SPAN_OPTIONS)[number]['value'];

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(value) ? value : 0);
}

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

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${formatNumber(value * 100, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`;
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

function parseTimelineKey(key: string) {
  const [year, month] = key.split('-');
  const parsedYear = Number(year);
  const parsedMonth = Number(month) - 1;
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) return null;
  return new Date(Date.UTC(parsedYear, Math.max(parsedMonth, 0), 1));
}

type MonthRange = {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
};

function getMonthRange(value: string | null | undefined): MonthRange | null {
  if (!value) return null;
  const match = /^([0-9]{4})-([0-9]{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  return {
    start,
    end,
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
  };
}

function formatMonthValue(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shiftMonthValue(value: string, offset: number, fallback: string): string {
  const range = getMonthRange(value) ?? getMonthRange(fallback);
  if (!range) return fallback;
  const next = new Date(range.start);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return formatMonthValue(next);
}

function formatRangeDisplay(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

type ChartPoint = {
  key: string;
  label: string;
  value: number;
  date: Date | null;
  profitAmount: number | null;
  profitCurrency: string | null;
  quotations: number;
  offersSent: number;
  approved: number;
};

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = useMemo(() => normalizeRole(session?.user?.role), [session?.user?.role]);
  const canAccessReports = hasPermission(role, 'accessReports');
  const currentMonthBound = useMemo(() => formatMonthValue(new Date()), []);

  const [data, setData] = useState<ReportsResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [pendingRange, setPendingRange] = useState({ start: '', end: '' });
  const [currentRange, setCurrentRange] = useState<{ start: string; end: string } | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetricValue>('profit');
  const [chartSpan, setChartSpan] = useState<ChartSpanValue>('6m');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthBound);
  const currentMonthRef = useRef(currentMonthBound);
  const requestIdRef = useRef(0);

  const fetchReports = useCallback(async (range?: { start?: string; end?: string }) => {
    const params = new URLSearchParams();
    if (range?.start) params.set('start', range.start);
    if (range?.end) params.set('end', range.end);
    const query = params.toString();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/quotations${query ? `?${query}` : ''}`, {
        cache: 'no-store',
      });

      let body: ReportsResponseBody | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok || !body?.success) {
        const message = body?.error ?? 'Unable to load reports data.';
        throw new Error(message);
      }

      const payload = body.data;
      setData(payload);
      setCurrentRange(payload.range);
      setPendingRange(payload.range);
    } catch (err: any) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(err?.message ?? 'Unable to load reports data.');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsFetching(false);
      }
    }
  }, []);

  const applyMonthRange = useCallback(
    (value: string) => {
      setSelectedMonth(value);
      const range = getMonthRange(value);
      if (!range) {
        return false;
      }
      currentMonthRef.current = value;
      const nextRange = { start: range.startISO, end: range.endISO };
      setPendingRange(nextRange);
      fetchReports(nextRange);
      return true;
    },
    [fetchReports],
  );

  useEffect(() => {
    if (status === 'loading') return;
    if (!canAccessReports) {
      router.replace('/dashboard');
    }
  }, [status, canAccessReports, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !canAccessReports) return;
    applyMonthRange(currentMonthRef.current);
  }, [status, canAccessReports, applyMonthRange]);

  const hasRangeChanges = useMemo(() => {
    if (!currentRange) {
      return Boolean(pendingRange.start || pendingRange.end);
    }
    return pendingRange.start !== currentRange.start || pendingRange.end !== currentRange.end;
  }, [pendingRange, currentRange]);

  const selectedMonthLabel = useMemo(() => {
    const range = getMonthRange(selectedMonth);
    if (!range) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(range.start);
  }, [selectedMonth]);

  const rangeDisplay = useMemo(() => {
    if (currentRange?.start && currentRange?.end) {
      return formatRangeDisplay(currentRange.start, currentRange.end);
    }
    const fallback = getMonthRange(selectedMonth);
    if (fallback) {
      return formatRangeDisplay(fallback.startISO, fallback.endISO);
    }
    return null;
  }, [currentRange, selectedMonth]);

  const canShiftForward = selectedMonth < currentMonthBound;
  const isInitialLoading = isFetching && !data;
  const summary = data?.summary;

  const summaryProfitBreakdownEntries = useMemo(() => {
    if (!summary) return [] as Array<[string, number]>;
    return Object.entries(summary.profitBreakdown)
      .filter(([, amount]) => Number.isFinite(amount))
      .sort((a, b) => b[1] - a[1]);
  }, [summary]);

  const chartSeries = useMemo(() => {
    if (!data?.timeline?.length) {
      return { points: [] as ChartPoint[], currency: summary?.currency ?? null };
    }

    const sorted = [...data.timeline]
      .map((point) => {
        const date = parseTimelineKey(point.key);
        const profitInfo = pickPrimaryAmount(point.profitBreakdown, summary?.currency);
        return {
          key: point.key,
          label: point.label,
          date,
          quotations: point.quotations,
          offersSent: point.offersSent,
          approved: point.approved,
          profitAmount: profitInfo?.amount ?? null,
          profitCurrency: profitInfo?.currency ?? summary?.currency ?? null,
        };
      })
      .sort((a, b) => {
        if (a.date && b.date) return a.date.getTime() - b.date.getTime();
        return a.key.localeCompare(b.key);
      });

    const spanFiltered = (() => {
      if (chartSpan === 'ytd') {
        const rangeEnd = currentRange ? new Date(`${currentRange.end}T00:00:00Z`) : new Date();
        const targetYear = rangeEnd.getUTCFullYear();
        return sorted.filter((item) => item.date?.getUTCFullYear() === targetYear);
      }
      const size = chartSpan === '4m' ? 4 : 6;
      return sorted.slice(Math.max(sorted.length - size, 0));
    })();

    const enriched: ChartPoint[] = spanFiltered.map((item) => {
      let value = 0;
      switch (chartMetric) {
        case 'profit':
          value = Number.isFinite(item.profitAmount ?? NaN) ? (item.profitAmount as number) : 0;
          break;
        case 'offers':
          value = item.offersSent;
          break;
        case 'approved':
          value = item.approved;
          break;
        default:
          value = item.quotations;
          break;
      }
      return {
        ...item,
        value,
      };
    });

    const resolvedCurrency =
      chartMetric === 'profit'
        ? (enriched.find((item) => item.profitCurrency)?.profitCurrency ??
          summary?.currency ??
          null)
        : null;

    return {
      points: enriched,
      currency: resolvedCurrency,
    };
  }, [data?.timeline, summary?.currency, chartMetric, chartSpan, currentRange]);

  const timelinePreview = useMemo(() => {
    if (!chartSeries.points.length) return [] as ChartPoint[];
    const count = Math.min(4, chartSeries.points.length);
    return chartSeries.points.slice(chartSeries.points.length - count);
  }, [chartSeries]);

  const clientsRemaining = useMemo(() => {
    if (!data) return 0;
    const approvedClients = data.totals?.approvedClients ?? 0;
    return Math.max(approvedClients - data.topClients.length, 0);
  }, [data]);

  const salesRemaining = useMemo(() => {
    if (!data) return 0;
    const totalSales = data.totals?.salesPeople ?? 0;
    return Math.max(totalSales - data.leaderboard.length, 0);
  }, [data]);

  const chartMetricLabel = useMemo(() => {
    return CHART_METRIC_OPTIONS.find((option) => option.value === chartMetric)?.label ?? 'Profit';
  }, [chartMetric]);

  const chartSpanLabel = useMemo(() => {
    return (
      CHART_SPAN_OPTIONS.find((option) => option.value === chartSpan)?.label ?? 'Last 6 months'
    );
  }, [chartSpan]);

  const chartPoints = chartSeries.points.map((point) => ({
    name: point.label,
    value: point.value,
  }));

  const chartCurrency = chartSeries.currency ?? summary?.currency ?? null;
  const chartHasData =
    chartPoints.length > 0 && chartPoints.some((item) => Number.isFinite(item.value));

  const handleStartChange = (value: string) => {
    setPendingRange((prev) => ({ ...prev, start: value }));
  };

  const handleEndChange = (value: string) => {
    setPendingRange((prev) => ({ ...prev, end: value }));
  };

  const handleApplyFilters = () => {
    if (isFetching) return;
    if (!hasRangeChanges && data) return;
    const start = pendingRange.start?.trim();
    const end = pendingRange.end?.trim();
    fetchReports({
      start: start ? start : undefined,
      end: end ? end : undefined,
    });

    const monthCandidate = (start ?? end)?.slice(0, 7);
    if (monthCandidate) {
      const normalizedMonth =
        monthCandidate > currentMonthBound ? currentMonthBound : monthCandidate;
      if (getMonthRange(normalizedMonth)) {
        currentMonthRef.current = normalizedMonth;
      }
      setSelectedMonth(normalizedMonth);
    }
  };

  const handleMonthInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      applyMonthRange(event.target.value);
    },
    [applyMonthRange],
  );

  const handleShiftMonth = useCallback(
    (offset: number) => {
      const nextValue = shiftMonthValue(selectedMonth, offset, currentMonthRef.current);
      const maxValue = currentMonthBound;
      if (offset > 0 && nextValue > maxValue) {
        return;
      }
      applyMonthRange(nextValue);
    },
    [selectedMonth, applyMonthRange, currentMonthBound],
  );

  const handleResetFilters = () => {
    if (isFetching) return;
    applyMonthRange(currentMonthBound);
  };

  const handleRetry = () => {
    if (isFetching) return;
    if (currentRange) {
      fetchReports({ start: currentRange.start, end: currentRange.end });
      const monthCandidate = currentRange.start?.slice(0, 7);
      if (monthCandidate) {
        const normalizedMonth =
          monthCandidate > currentMonthBound ? currentMonthBound : monthCandidate;
        if (getMonthRange(normalizedMonth)) {
          currentMonthRef.current = normalizedMonth;
        }
        setSelectedMonth(normalizedMonth);
      }
    } else {
      applyMonthRange(currentMonthRef.current);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">
        Loading reports...
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
          <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Analytics</h1>
          <p className="text-gray-600">Business intelligence and performance insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2" disabled={isFetching}>
            <Download className="h-4 w-4" />
            Export Data
          </Button>
          <Button className="flex items-center gap-2" disabled={isFetching}>
            <FileText className="h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Quick month filter
              </p>
              <p className="text-sm font-medium text-gray-900">
                {selectedMonthLabel ?? selectedMonth}
              </p>
              {rangeDisplay && <p className="text-xs text-gray-500">{rangeDisplay}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => handleShiftMonth(-1)}
                aria-label="Previous month"
                disabled={isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="month"
                className="w-36"
                value={selectedMonth}
                onChange={handleMonthInputChange}
                max={currentMonthBound}
                aria-label="Select month"
                disabled={isFetching}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => handleShiftMonth(1)}
                aria-label="Next month"
                disabled={isFetching || !canShiftForward}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr,1fr,auto] lg:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="report-start-date">
                Start date
              </label>
              <Input
                id="report-start-date"
                type="date"
                value={pendingRange.start}
                onChange={(event) => handleStartChange(event.target.value)}
                max={pendingRange.end || undefined}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="report-end-date">
                End date
              </label>
              <Input
                id="report-end-date"
                type="date"
                value={pendingRange.end}
                onChange={(event) => handleEndChange(event.target.value)}
                min={pendingRange.start || undefined}
              />
            </div>
            <div className="flex items-center gap-2 lg:justify-end">
              <Button variant="outline" onClick={handleResetFilters} disabled={isFetching}>
                Reset
              </Button>
              <Button
                onClick={handleApplyFilters}
                disabled={isFetching || (!hasRangeChanges && Boolean(data))}
              >
                <Filter className="mr-2 h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {rangeDisplay
              ? `Showing data for ${rangeDisplay}`
              : 'Select a start and end date to filter the report.'}
          </p>
          {isFetching && data ? (
            <p className="text-xs text-gray-400">Refreshing report data…</p>
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
            <div className="animate-pulse text-sm text-gray-500">Loading report data…</div>
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quotations</CardTitle>
                <FileText className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(summary?.totalQuotations ?? 0)}
                </div>
                <p className="text-xs text-gray-500">Total quotations in the selected range.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Offers Sent</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary?.offersSent ?? 0)}</div>
                <p className="text-xs text-gray-500">
                  Covers all quotation statuses marked as offers.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(summary?.approved ?? 0)}
                </div>
                <p className="text-xs text-gray-500">
                  Approval rate {formatPercent(summary?.approvalRate ?? 0)}.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrencyAmount(summary?.totalProfit ?? 0, summary?.currency)}
                </div>
                {summaryProfitBreakdownEntries.length ? (
                  <div className="space-y-1 text-xs text-gray-500">
                    {summaryProfitBreakdownEntries.map(([currency, amount]) => (
                      <div key={currency}>
                        {currency.toUpperCase()}: {formatCurrencyAmount(amount, currency)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No profit recorded for this range.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-dashed border-blue-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                  <div>
                    <CardTitle className="text-lg">External Shipments KPI</CardTitle>
                    <CardDescription>
                      Review shipment counts, revenue, and profit grouped by sales owner.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  Jump to the detailed KPI table to explore sales performance and drill down into
                  shipment activity.
                </p>
                <Button
                  className="w-full"
                  onClick={() => router.push('/reports/external-shipments')}
                >
                  View KPI
                </Button>
              </CardContent>
            </Card>

            {PLACEHOLDER_REPORTS.map((report) => {
              const Icon = report.icon;
              return (
                <Card key={report.id} className="border-dashed border-gray-200">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Icon className="h-8 w-8 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">{report.title}</CardTitle>
                        <CardDescription>{report.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-500">
                      Detailed visuals and drill-downs will arrive soon.
                    </p>
                    <Button variant="outline" size="sm" disabled className="w-full">
                      Coming soon
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top Clients by Approvals
                  </CardTitle>
                  <CardDescription>
                    Ranked by approved quotations in the selected period.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" disabled>
                  More (coming soon)
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.topClients.length ? (
                  data.topClients.map((client, index) => {
                    const profit = pickPrimaryAmount(client.profitBreakdown, summary?.currency);
                    return (
                      <div
                        key={client.client}
                        className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{client.client}</p>
                            <p className="text-xs text-gray-500">
                              {client.approvals} approvals / {client.quotations} quotations
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm font-medium text-gray-900">
                          {profit
                            ? formatCurrencyAmount(profit.amount, profit.currency)
                            : 'No profit'}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">
                    No approved clients within the selected range.
                  </p>
                )}
                {clientsRemaining > 0 ? (
                  <p className="text-xs text-gray-400">
                    +{clientsRemaining} more clients available in full reports.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Sales Leadership
                  </CardTitle>
                  <CardDescription>Top performers by offers sent and approvals.</CardDescription>
                </div>
                <Button variant="outline" size="sm" disabled>
                  View all (coming soon)
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.leaderboard.length ? (
                  data.leaderboard.map((row, index) => {
                    const profit = pickPrimaryAmount(row.profitBreakdown, summary?.currency);
                    return (
                      <div
                        key={`${row.name}-${index}`}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{row.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatNumber(row.quotations)} quotations /{' '}
                              {formatNumber(row.offersSent)} offers
                            </p>
                          </div>
                          <div className="text-sm font-semibold text-green-600">
                            {formatNumber(row.approved)} approved
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>Approval rate {formatPercent(row.approvalRate)}</span>
                          <span>
                            Profit{' '}
                            {profit ? formatCurrencyAmount(profit.amount, profit.currency) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">No sales activity in this range.</p>
                )}
                {salesRemaining > 0 ? (
                  <p className="text-xs text-gray-400">
                    +{salesRemaining} more salespeople recorded across all data.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Profit &amp; Activity Trend
                  </CardTitle>
                  <CardDescription>
                    Visualizes historical performance; ready for future KPI overlays.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={chartMetric}
                    onValueChange={(value) => setChartMetric(value as ChartMetricValue)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHART_METRIC_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={chartSpan}
                    onValueChange={(value) => setChartSpan(value as ChartSpanValue)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHART_SPAN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-72 w-full">
                {chartHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartPoints}
                      margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#475569" tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#475569"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: number) =>
                          chartMetric === 'profit'
                            ? formatCurrencyAmount(value, chartCurrency)
                            : formatNumber(value)
                        }
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          chartMetric === 'profit'
                            ? formatCurrencyAmount(value, chartCurrency)
                            : formatNumber(value)
                        }
                        labelFormatter={(label: string) => `${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={chartMetric === 'profit' ? '#7c3aed' : '#2563eb'}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                    Not enough data to plot {chartMetricLabel} over {chartSpanLabel}.
                  </div>
                )}
              </div>
              {timelinePreview.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {timelinePreview.map((point) => (
                    <div key={point.key} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-medium text-gray-900">{point.label}</p>
                      <p className="text-sm text-gray-700">
                        {Number.isFinite(point.profitAmount ?? NaN) && point.profitCurrency
                          ? formatCurrencyAmount(point.profitAmount as number, point.profitCurrency)
                          : 'No profit recorded'}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-gray-500">
                        <div>Quotations: {formatNumber(point.quotations)}</div>
                        <div>Offers sent: {formatNumber(point.offersSent)}</div>
                        <div>Approved: {formatNumber(point.approved)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Timeline data is not available for the selected range.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {!data && !isInitialLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">
              No report data is available yet. Adjust the filters and try again.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
