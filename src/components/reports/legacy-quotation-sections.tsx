'use client';

import Link from 'next/link';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  ChevronLeft,
  ExternalLink,
  FileText,
  Loader2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

interface ReportsSummary {
  totalQuotations: number;
  offersSent: number;
  closed: number;
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

/** Quotation rows returned by report drill-down APIs. */
interface ReportQuotationListRow {
  id: string;
  quotationNumber: string;
  client: string;
  status: string;
  createdAt: string;
  origin: string;
  destination: string;
  estimatedCost: number;
  salesManager: string | null;
}

interface TimelinePoint {
  key: string;
  label: string;
  quotations: number;
  offersSent: number;
  closed: number;
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
  { value: 'quotations', label: 'Quotations' },
  { value: 'closed', label: 'Closed Quotations' },
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
  quotations: number;
  offersSent: number;
  closed: number;
  approved: number;
};

type LegacyQuotationSectionsProps = {
  startDate?: string;
  endDate?: string;
};

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${formatNumber(value * 100, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`;
}

function parseTimelineKey(key: string) {
  const [year, month] = key.split('-');
  const parsedYear = Number(year);
  const parsedMonth = Number(month) - 1;
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) return null;
  return new Date(Date.UTC(parsedYear, Math.max(parsedMonth, 0), 1));
}

function formatReportRangeLabel(range: { start: string; end: string } | undefined) {
  if (!range?.start || !range?.end) return null;
  return `${range.start} → ${range.end}`;
}

function ReportQuotationListBlock({
  loading,
  error,
  rows,
  onRetry,
  emptyMessage,
}: {
  loading: boolean;
  error: string | null;
  rows: ReportQuotationListRow[];
  onRetry: () => void;
  emptyMessage: string;
}) {
  if (loading) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 px-6 py-16 text-sm">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading quotations…
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-3 px-6 py-8">
        <p className="text-sm text-red-700">{error}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (!rows.length) {
    return <p className="text-muted-foreground px-6 py-10 text-center text-sm">{emptyMessage}</p>;
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
      <p className="text-muted-foreground mb-3 text-xs sm:text-sm">
        {formatNumber(rows.length)} quotation{rows.length === 1 ? '' : 's'} in this period.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead className="min-w-[140px]">Route</TableHead>
            <TableHead className="hidden md:table-cell">Client</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Est. cost</TableHead>
            <TableHead className="w-[100px] text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="max-w-[120px] truncate font-medium">
                {q.quotationNumber}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal">
                  {q.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                {new Date(q.createdAt).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </TableCell>
              <TableCell className="max-w-[220px] text-xs text-gray-800 sm:max-w-xs">
                <span className="line-clamp-2">
                  {q.origin} → {q.destination}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground hidden max-w-[160px] truncate text-xs md:table-cell">
                {q.client}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums lg:table-cell">
                {formatNumber(q.estimatedCost, {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 0,
                })}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                  <Link href={`/quotations/${q.id}/edit`}>
                    <ExternalLink className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function LegacyQuotationSections({ startDate, endDate }: LegacyQuotationSectionsProps) {
  const t = useT();
  const [data, setData] = useState<QuotationsReportsResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [chartMetric, setChartMetric] = useState<ChartMetricValue>('quotations');
  const [chartSpan, setChartSpan] = useState<ChartSpanValue>('6m');
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const requestIdRef = useRef(0);

  const [clientsModalOpen, setClientsModalOpen] = useState(false);
  const [clientsModalData, setClientsModalData] = useState<ClientApprovalEntry[]>([]);
  const [clientsModalLoading, setClientsModalLoading] = useState(false);
  const [clientsModalError, setClientsModalError] = useState<string | null>(null);
  const [clientsModalSearch, setClientsModalSearch] = useState('');
  const [clientsModalView, setClientsModalView] = useState<'list' | 'quotations'>('list');
  const [selectedClientRow, setSelectedClientRow] = useState<ClientApprovalEntry | null>(null);
  const [clientQuotations, setClientQuotations] = useState<ReportQuotationListRow[]>([]);
  const [clientQuotationsLoading, setClientQuotationsLoading] = useState(false);
  const [clientQuotationsError, setClientQuotationsError] = useState<string | null>(null);

  const [leaderboardModalOpen, setLeaderboardModalOpen] = useState(false);
  const [leaderboardModalData, setLeaderboardModalData] = useState<SalesLeaderboardEntry[]>([]);
  const [leaderboardModalLoading, setLeaderboardModalLoading] = useState(false);
  const [leaderboardModalView, setLeaderboardModalView] = useState<'list' | 'quotations'>('list');
  const [leaderboardModalSearch, setLeaderboardModalSearch] = useState('');
  const [selectedSalesRow, setSelectedSalesRow] = useState<SalesLeaderboardEntry | null>(null);
  const [salesQuotations, setSalesQuotations] = useState<ReportQuotationListRow[]>([]);
  const [salesQuotationsLoading, setSalesQuotationsLoading] = useState(false);
  const [salesQuotationsError, setSalesQuotationsError] = useState<string | null>(null);

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

  const fetchClientQuotations = useCallback(
    async (clientName: string) => {
      setClientQuotationsLoading(true);
      setClientQuotationsError(null);
      setClientQuotations([]);
      try {
        const params = new URLSearchParams({ listQuotationsForClient: clientName });
        if (startDate) params.set('start', startDate);
        if (endDate) params.set('end', endDate);
        const res = await fetch(`/api/reports/quotations?${params.toString()}`, {
          cache: 'no-store',
        });
        let body: {
          success?: boolean;
          data?: { quotations?: ReportQuotationListRow[] };
          error?: string;
        } | null = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        if (res.ok && body?.success && Array.isArray(body.data?.quotations)) {
          setClientQuotations(body.data!.quotations!);
        } else {
          setClientQuotationsError(body?.error ?? 'Unable to load quotations for this client.');
        }
      } catch (err: any) {
        setClientQuotationsError(err?.message ?? 'Unable to load quotations for this client.');
      } finally {
        setClientQuotationsLoading(false);
      }
    },
    [startDate, endDate],
  );

  const backToClientListFromQuotations = useCallback(() => {
    setClientsModalView('list');
    setSelectedClientRow(null);
    setClientQuotations([]);
    setClientQuotationsError(null);
    setClientQuotationsLoading(false);
  }, []);

  const fetchAllClients = useCallback(async () => {
    setClientsModalLoading(true);
    setClientsModalError(null);
    try {
      const params = new URLSearchParams({ topClientsLimit: '200' });
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const res = await fetch(`/api/reports/quotations?${params}`, { cache: 'no-store' });
      let body: QuotationsReportsResponseBody | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (res.ok && body?.success) {
        setClientsModalData(body.data.topClients);
      } else {
        setClientsModalData([]);
        setClientsModalError(body?.error ?? 'Unable to load the full client list.');
      }
    } catch (err: any) {
      setClientsModalData([]);
      setClientsModalError(err?.message ?? 'Unable to load the full client list.');
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

  const fetchSalesQuotations = useCallback(
    async (salesLabel: string) => {
      setSalesQuotationsLoading(true);
      setSalesQuotationsError(null);
      setSalesQuotations([]);
      try {
        const params = new URLSearchParams({ listQuotationsForSales: salesLabel });
        if (startDate) params.set('start', startDate);
        if (endDate) params.set('end', endDate);
        const res = await fetch(`/api/reports/quotations?${params.toString()}`, {
          cache: 'no-store',
        });
        let body: {
          success?: boolean;
          data?: { quotations?: ReportQuotationListRow[] };
          error?: string;
        } | null = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        if (res.ok && body?.success && Array.isArray(body.data?.quotations)) {
          setSalesQuotations(body.data!.quotations!);
        } else {
          setSalesQuotationsError(body?.error ?? 'Unable to load quotations for this salesperson.');
        }
      } catch (err: any) {
        setSalesQuotationsError(err?.message ?? 'Unable to load quotations for this salesperson.');
      } finally {
        setSalesQuotationsLoading(false);
      }
    },
    [startDate, endDate],
  );

  const backToSalesLeaderboardList = useCallback(() => {
    setLeaderboardModalView('list');
    setSelectedSalesRow(null);
    setSalesQuotations([]);
    setSalesQuotationsError(null);
    setSalesQuotationsLoading(false);
  }, []);

  const openSalesQuotationsDrilldown = useCallback(
    (row: SalesLeaderboardEntry) => {
      setLeaderboardModalOpen(true);
      setLeaderboardModalView('quotations');
      setSelectedSalesRow(row);
      void fetchAllLeaderboard();
      void fetchSalesQuotations(row.name);
    },
    [fetchAllLeaderboard, fetchSalesQuotations],
  );

  const summary = data?.summary;

  const chartSeries = useMemo(() => {
    if (!data?.timeline?.length) {
      return { points: [] as ChartPoint[] };
    }

    const sorted = [...data.timeline]
      .map((point) => {
        const date = parseTimelineKey(point.key);
        return {
          key: point.key,
          label: point.label,
          date,
          quotations: point.quotations,
          offersSent: point.offersSent,
          closed: point.closed,
          approved: point.approved,
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
        case 'closed':
          value = item.closed;
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

    return { points: enriched };
  }, [data?.range?.end, data?.timeline, chartMetric, chartSpan]);

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
    return (
      CHART_METRIC_OPTIONS.find((option) => option.value === chartMetric)?.label ?? 'Quotations'
    );
  }, [chartMetric]);

  const chartSpanLabel = useMemo(() => {
    return (
      CHART_SPAN_OPTIONS.find((option) => option.value === chartSpan)?.label ?? 'Last 6 months'
    );
  }, [chartSpan]);

  const filteredClientsModalRows = useMemo(() => {
    const q = clientsModalSearch.trim().toLowerCase();
    if (!q) return clientsModalData;
    return clientsModalData.filter((row) => row.client.toLowerCase().includes(q));
  }, [clientsModalData, clientsModalSearch]);

  const filteredLeaderboardModalRows = useMemo(() => {
    const q = leaderboardModalSearch.trim().toLowerCase();
    if (!q) return leaderboardModalData;
    return leaderboardModalData.filter((row) => row.name.toLowerCase().includes(q));
  }, [leaderboardModalData, leaderboardModalSearch]);

  const chartPoints = chartSeries.points.map((point) => ({
    name: point.label,
    value: point.value,
  }));

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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
                <CardTitle className="text-sm font-medium">Closed Quotations</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary?.closed ?? 0)}</div>
                <p className="text-xs text-gray-500">
                  Total closed quotations in the selected range.
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
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="lg:order-1">
              <CardHeader className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {t('reports.quotationsLeaderboard.salesTitle')}
                  </CardTitle>
                  <CardDescription>
                    Ranked by quotation count in this period. Click a row to see that person&apos;s
                    quotations.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLeaderboardModalSearch('');
                    setLeaderboardModalView('list');
                    setSelectedSalesRow(null);
                    setSalesQuotations([]);
                    setSalesQuotationsError(null);
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
                    const offset = leaderboardPagination
                      ? (leaderboardPagination.page - 1) * leaderboardPagination.pageSize
                      : 0;
                    const rank = offset + index + 1;
                    return (
                      <button
                        key={`${row.name}-${index}`}
                        type="button"
                        onClick={() => openSalesQuotationsDrilldown(row)}
                        className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                          {rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900">{row.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatNumber(row.quotations)} quotations
                            {` · ${formatNumber(row.approved)} approved`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-semibold text-blue-700 tabular-nums">
                            {formatNumber(row.quotations)}
                          </p>
                          <p className="text-[10px] tracking-wide text-gray-400 uppercase">
                            Quotations
                          </p>
                        </div>
                      </button>
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

            <Card className="lg:order-2">
              <CardHeader className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t('reports.quotationsLeaderboard.topClientsTitle')}
                  </CardTitle>
                  <CardDescription>
                    Ranked by quotation count in the selected period.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClientsModalSearch('');
                    setClientsModalError(null);
                    setClientsModalView('list');
                    setSelectedClientRow(null);
                    setClientQuotations([]);
                    setClientQuotationsError(null);
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
                        className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900">{client.client}</p>
                          <p className="text-xs text-gray-500">
                            {formatNumber(client.quotations)} quotations
                            {` · ${formatNumber(client.approvals)} approved`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-semibold text-gray-900 tabular-nums">
                            {formatNumber(client.quotations)}
                          </p>
                          <p className="text-[10px] tracking-wide text-gray-400 uppercase">
                            Quotations
                          </p>
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
          </div>
          {/* 
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Activity trend
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
                        tickFormatter={(value: number) => formatNumber(value)}
                      />
                      <Tooltip
                        formatter={(value: number) => formatNumber(value)}
                        labelFormatter={(label: string) => `${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#2563eb"
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
                        {chartMetricLabel}: {formatNumber(point.value)}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-gray-500">
                        <div>Quotations: {formatNumber(point.quotations)}</div>
                        <div>Closed: {formatNumber(point.closed)}</div>
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
          </Card> */}
        </>
      ) : null}

      {/* All clients (by quotation count) — full ranked list for the selected period */}
      <Dialog
        open={clientsModalOpen}
        onOpenChange={(open) => {
          setClientsModalOpen(open);
          if (!open) {
            setClientsModalSearch('');
            setClientsModalError(null);
            setClientsModalView('list');
            setSelectedClientRow(null);
            setClientQuotations([]);
            setClientQuotationsError(null);
            setClientQuotationsLoading(false);
          }
        }}
      >
        <DialogContent className="flex w-[96vw] max-w-5xl flex-col overflow-hidden p-0 sm:max-h-[92vh]">
          <DialogHeader className="border-b border-gray-100 px-6 pt-6 pr-12 pb-4">
            {clientsModalView === 'quotations' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-3 w-fit"
                  onClick={backToClientListFromQuotations}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back to all clients
                </Button>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <Users className="h-5 w-5 shrink-0" />
                  <span>Quotations</span>
                  <span className="text-muted-foreground font-normal">—</span>
                  <span className="break-words">{selectedClientRow?.client}</span>
                </DialogTitle>
                <DialogDescription className="text-left">
                  Every quotation for this client in the report period (same matching rules as the
                  client ranking). Open a row to edit in the main quotations workspace.
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All clients by quotation count
                </DialogTitle>
                <DialogDescription className="text-left">
                  Clients are ranked by quotation count in this period (then by approvals).{' '}
                  <span className="font-medium text-gray-700">Click a row</span> to see all
                  quotations for that client.
                </DialogDescription>
              </>
            )}
            {formatReportRangeLabel(data?.range) ? (
              <p className="text-muted-foreground pt-1 text-xs sm:text-sm">
                Period: <span className="font-medium">{formatReportRangeLabel(data?.range)}</span>
              </p>
            ) : null}
          </DialogHeader>

          {clientsModalView === 'quotations' ? (
            <ReportQuotationListBlock
              loading={clientQuotationsLoading}
              error={clientQuotationsError}
              rows={clientQuotations}
              onRetry={() => {
                if (selectedClientRow) fetchClientQuotations(selectedClientRow.client);
              }}
              emptyMessage="No quotations found for this client in the selected period."
            />
          ) : clientsModalLoading ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 px-6 py-16 text-sm">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading clients…
            </div>
          ) : clientsModalError ? (
            <div className="space-y-3 px-6 py-8">
              <p className="text-sm text-red-700">{clientsModalError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  fetchAllClients();
                }}
              >
                Retry
              </Button>
            </div>
          ) : clientsModalData.length ? (
            <>
              <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  placeholder="Filter by client name…"
                  value={clientsModalSearch}
                  onChange={(e) => setClientsModalSearch(e.target.value)}
                  className="sm:max-w-xs"
                  aria-label="Filter clients by name"
                />
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Showing{' '}
                  <span className="font-medium text-gray-900">
                    {filteredClientsModalRows.length}
                  </span>{' '}
                  of <span className="font-medium text-gray-900">{clientsModalData.length}</span>
                  {typeof data?.totals?.clients === 'number' && data.totals.clients > 0 ? (
                    <>
                      {' '}
                      · <span className="font-medium text-gray-900">
                        {data.totals.clients}
                      </span>{' '}
                      distinct clients in range
                    </>
                  ) : null}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {filteredClientsModalRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Quotations</TableHead>
                        <TableHead className="text-right">Approved</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientsModalRows.map((client) => {
                        const globalRank =
                          clientsModalData.findIndex((row) => row.client === client.client) + 1;
                        return (
                          <TableRow
                            key={`${client.client}-${globalRank}`}
                            className="hover:bg-muted/50 cursor-pointer"
                            tabIndex={0}
                            role="button"
                            onClick={() => {
                              setSelectedClientRow(client);
                              setClientsModalView('quotations');
                              fetchClientQuotations(client.client);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedClientRow(client);
                                setClientsModalView('quotations');
                                fetchClientQuotations(client.client);
                              }
                            }}
                          >
                            <TableCell className="text-center font-medium text-gray-600">
                              {globalRank}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate font-medium text-gray-900 sm:max-w-md">
                              {client.client}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(client.quotations)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(client.approvals)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No clients match “{clientsModalSearch.trim()}”.
                  </p>
                )}
              </div>
              {clientsModalData.length >= 200 && (data?.totals?.clients ?? 0) > 200 ? (
                <p className="text-muted-foreground border-t border-gray-100 px-6 py-2 text-xs">
                  List is capped at 200 rows. Adjust the date range or export from analytics if you
                  need the full set.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground px-6 py-10 text-center text-sm">
              No client data for this period.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Sales leadership — full list + drill-down to quotations */}
      <Dialog
        open={leaderboardModalOpen}
        onOpenChange={(open) => {
          setLeaderboardModalOpen(open);
          if (!open) {
            setLeaderboardModalSearch('');
            setLeaderboardModalView('list');
            setSelectedSalesRow(null);
            setSalesQuotations([]);
            setSalesQuotationsError(null);
            setSalesQuotationsLoading(false);
          }
        }}
      >
        <DialogContent className="flex w-[96vw] max-w-5xl flex-col overflow-hidden p-0 sm:max-h-[92vh]">
          <DialogHeader className="border-b border-gray-100 px-6 pt-6 pr-12 pb-4">
            {leaderboardModalView === 'quotations' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-3 w-fit"
                  onClick={backToSalesLeaderboardList}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back to all salespeople
                </Button>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <BarChart3 className="h-5 w-5 shrink-0" />
                  <span>Quotations</span>
                  <span className="text-muted-foreground font-normal">—</span>
                  <span className="break-words">{selectedSalesRow?.name}</span>
                </DialogTitle>
                <DialogDescription className="text-left">
                  Quotations attributed to this salesperson in the report period (same rules as the
                  leadership ranking). Open a row to edit.
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  All salespeople by quotation count
                </DialogTitle>
                <DialogDescription className="text-left">
                  Ranked by quotations in this period.{' '}
                  <span className="font-medium text-gray-700">Click a row</span> to see every
                  quotation for that person.
                </DialogDescription>
              </>
            )}
            {formatReportRangeLabel(data?.range) ? (
              <p className="text-muted-foreground pt-1 text-xs sm:text-sm">
                Period: <span className="font-medium">{formatReportRangeLabel(data?.range)}</span>
              </p>
            ) : null}
          </DialogHeader>

          {leaderboardModalView === 'quotations' ? (
            <ReportQuotationListBlock
              loading={salesQuotationsLoading}
              error={salesQuotationsError}
              rows={salesQuotations}
              onRetry={() => {
                if (selectedSalesRow) fetchSalesQuotations(selectedSalesRow.name);
              }}
              emptyMessage="No quotations found for this salesperson in the selected period."
            />
          ) : leaderboardModalLoading ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 px-6 py-16 text-sm">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading salespeople…
            </div>
          ) : leaderboardModalData.length ? (
            <>
              <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  placeholder="Filter by name…"
                  value={leaderboardModalSearch}
                  onChange={(e) => setLeaderboardModalSearch(e.target.value)}
                  className="sm:max-w-xs"
                  aria-label="Filter salespeople by name"
                />
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Showing{' '}
                  <span className="font-medium text-gray-900">
                    {filteredLeaderboardModalRows.length}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-gray-900">{leaderboardModalData.length}</span>
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {filteredLeaderboardModalRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Salesperson</TableHead>
                        <TableHead className="text-right">Quotations</TableHead>
                        <TableHead className="text-right">Approved</TableHead>
                        <TableHead className="text-right">Offers sent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeaderboardModalRows.map((row) => {
                        const globalRank =
                          leaderboardModalData.findIndex((r) => r.name === row.name) + 1;
                        return (
                          <TableRow
                            key={`${row.name}-${globalRank}`}
                            className="hover:bg-muted/50 cursor-pointer"
                            tabIndex={0}
                            role="button"
                            onClick={() => {
                              setSelectedSalesRow(row);
                              setLeaderboardModalView('quotations');
                              fetchSalesQuotations(row.name);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedSalesRow(row);
                                setLeaderboardModalView('quotations');
                                fetchSalesQuotations(row.name);
                              }
                            }}
                          >
                            <TableCell className="text-center font-medium text-gray-600">
                              {globalRank}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate font-medium text-gray-900 sm:max-w-md">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.quotations)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.approved)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.offersSent)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No names match “{leaderboardModalSearch.trim()}”.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground px-6 py-10 text-center text-sm">
              No sales data for this period.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
