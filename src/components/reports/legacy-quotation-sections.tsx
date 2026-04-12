'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3, FileText, TrendingUp, Users } from 'lucide-react';

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

interface QuotationsReportsResponseData {
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
  pagination?: {
    leaderboard: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}

interface QuotationsReportsResponseBody {
  success: boolean;
  data: QuotationsReportsResponseData;
  error?: string;
}

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

const LEADERBOARD_PAGE_SIZE = 5;

type ChartMetricValue = (typeof CHART_METRIC_OPTIONS)[number]['value'];
type ChartSpanValue = (typeof CHART_SPAN_OPTIONS)[number]['value'];

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

type LegacyQuotationSectionsProps = {
  startDate?: string;
  endDate?: string;
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

export function LegacyQuotationSections({ startDate, endDate }: LegacyQuotationSectionsProps) {
  const [data, setData] = useState<QuotationsReportsResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [chartMetric, setChartMetric] = useState<ChartMetricValue>('profit');
  const [chartSpan, setChartSpan] = useState<ChartSpanValue>('6m');
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const requestIdRef = useRef(0);

  const [clientsModalOpen, setClientsModalOpen] = useState(false);
  const [clientsModalData, setClientsModalData] = useState<ClientApprovalEntry[]>([]);
  const [clientsModalLoading, setClientsModalLoading] = useState(false);

  const [leaderboardModalOpen, setLeaderboardModalOpen] = useState(false);
  const [leaderboardModalData, setLeaderboardModalData] = useState<SalesLeaderboardEntry[]>([]);
  const [leaderboardModalLoading, setLeaderboardModalLoading] = useState(false);

  const fetchReports = useCallback(
    async (page: number) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsFetching(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          leaderboardPage: String(page),
          leaderboardPageSize: String(LEADERBOARD_PAGE_SIZE),
        });
        if (startDate) params.set('start', startDate);
        if (endDate) params.set('end', endDate);

        const response = await fetch(`/api/reports/quotations?${params.toString()}`, {
          cache: 'no-store',
        });

        let body: QuotationsReportsResponseBody | null = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }

        if (!response.ok || !body?.success) {
          const message = body?.error ?? 'Unable to load quotation report sections.';
          throw new Error(message);
        }

        if (requestId !== requestIdRef.current) {
          return;
        }

        setData(body.data);
        const serverPage = body.data.pagination?.leaderboard?.page ?? page;
        setLeaderboardPage(serverPage);
      } catch (err: any) {
        if (requestId === requestIdRef.current) {
          setError(err?.message ?? 'Unable to load quotation report sections.');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsFetching(false);
        }
      }
    },
    [endDate, startDate],
  );

  useEffect(() => {
    setLeaderboardPage(1);
    fetchReports(1);
  }, [fetchReports]);

  const fetchAllClients = useCallback(async () => {
    setClientsModalLoading(true);
    try {
      const params = new URLSearchParams({ topClientsLimit: '200' });
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const res = await fetch(`/api/reports/quotations?${params}`, { cache: 'no-store' });
      const body = await res.json();
      if (res.ok && body?.success) {
        setClientsModalData(body.data.topClients);
      }
    } finally {
      setClientsModalLoading(false);
    }
  }, [startDate, endDate]);

  const fetchAllLeaderboard = useCallback(async () => {
    setLeaderboardModalLoading(true);
    try {
      const params = new URLSearchParams({ leaderboardAll: 'true' });
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const res = await fetch(`/api/reports/quotations?${params}`, { cache: 'no-store' });
      const body = await res.json();
      if (res.ok && body?.success) {
        setLeaderboardModalData(body.data.leaderboard);
      }
    } finally {
      setLeaderboardModalLoading(false);
    }
  }, [startDate, endDate]);

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
        const rangeEnd = data?.range?.end ? new Date(`${data.range.end}T00:00:00Z`) : new Date();
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
  }, [data?.range?.end, data?.timeline, summary?.currency, chartMetric, chartSpan]);

  const timelinePreview = useMemo(() => {
    if (!chartSeries.points.length) return [] as ChartPoint[];
    const count = Math.min(4, chartSeries.points.length);
    return chartSeries.points.slice(chartSeries.points.length - count);
  }, [chartSeries]);

  const clientsRemaining = useMemo(() => {
    if (!data) return 0;
    const totalClients = data.totals?.clients ?? 0;
    return Math.max(totalClients - data.topClients.length, 0);
  }, [data]);

  const salesRemaining = useMemo(() => {
    if (!data) return 0;
    const totalSales = data.totals?.salesPeople ?? 0;
    return Math.max(totalSales - data.leaderboard.length, 0);
  }, [data]);

  const leaderboardPagination = data?.pagination?.leaderboard ?? null;
  const leaderboardTotalPages = useMemo(() => {
    if (!leaderboardPagination) return 1;
    return Math.max(1, Math.ceil(leaderboardPagination.total / leaderboardPagination.pageSize));
  }, [leaderboardPagination]);

  const canGoPrev = leaderboardPagination ? leaderboardPagination.page > 1 : false;
  const canGoNext = leaderboardPagination
    ? leaderboardPagination.page < leaderboardTotalPages
    : false;

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

  const handleLeaderboardPageChange = (direction: 'prev' | 'next') => {
    if (!leaderboardPagination || isFetching) return;
    const target =
      direction === 'prev' ? leaderboardPagination.page - 1 : leaderboardPagination.page + 1;
    if (target < 1 || target > leaderboardTotalPages) return;
    fetchReports(target);
  };

  return (
    <div className="space-y-6">
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fetchReports(leaderboardPage)}
                disabled={isFetching}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!data && isFetching ? (
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse text-sm text-gray-500">
              Loading quotation report data…
            </div>
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
            <Card>
              <CardHeader className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top Clients by Quotations
                  </CardTitle>
                  <CardDescription>
                    Ranked by quotation count in the selected period.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClientsModalOpen(true);
                    fetchAllClients();
                  }}
                >
                  View all
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.topClients.length ? (
                  data.topClients.map((client, index) => {
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
                            <p className="text-xs text-gray-500">{client.quotations} quotations</p>
                          </div>
                        </div>
                        <div className="text-right text-sm font-medium text-gray-900">
                          {formatNumber(client.quotations)} quotations
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">
                    No clients found within the selected range.
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
                  <CardDescription>Top performers by quotation count.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLeaderboardModalOpen(true);
                    fetchAllLeaderboard();
                  }}
                >
                  View all
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.leaderboard.length ? (
                  data.leaderboard.map((row, index) => {
                    return (
                      <div
                        key={`${row.name}-${index}`}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{row.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatNumber(row.quotations)} quotations
                            </p>
                          </div>
                          <div className="text-sm font-semibold text-blue-700">
                            {formatNumber(row.quotations)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">No sales activity in this range.</p>
                )}
                {leaderboardPagination ? (
                  <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-gray-400">
                      Page {leaderboardPagination.page} of {leaderboardTotalPages} ·{' '}
                      {leaderboardPagination.total} salespeople
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canGoPrev || isFetching}
                        onClick={() => handleLeaderboardPageChange('prev')}
                      >
                        Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canGoNext || isFetching}
                        onClick={() => handleLeaderboardPageChange('next')}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : salesRemaining > 0 ? (
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
                    Profit & Activity Trend
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

      {/* All Clients Modal */}
      <Dialog open={clientsModalOpen} onOpenChange={setClientsModalOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Clients by Quotations
            </DialogTitle>
          </DialogHeader>
          {clientsModalLoading ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
          ) : clientsModalData.length ? (
            <div className="space-y-2">
              {clientsModalData.map((client, index) => {
                return (
                  <div
                    key={client.client}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{client.client}</p>
                        <p className="text-xs text-gray-500">{client.quotations} quotations</p>
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium text-gray-900">
                      {formatNumber(client.quotations)} quotations
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-gray-500">No client data available.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* All Leaderboard Modal */}
      <Dialog open={leaderboardModalOpen} onOpenChange={setLeaderboardModalOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Sales Leadership — Full List
            </DialogTitle>
          </DialogHeader>
          {leaderboardModalLoading ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
          ) : leaderboardModalData.length ? (
            <div className="space-y-2">
              {leaderboardModalData.map((row, index) => {
                return (
                  <div
                    key={`${row.name}-${index}`}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{row.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatNumber(row.quotations)} quotations
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-blue-700">
                        {formatNumber(row.quotations)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-gray-500">No leaderboard data available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
