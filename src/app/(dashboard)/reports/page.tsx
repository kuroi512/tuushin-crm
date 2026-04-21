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
} from 'recharts';
import { BarChart3, ExternalLink, Filter, Users, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { hasPermission, normalizeRole } from '@/lib/permissions';
import { useT } from '@/lib/i18n';
import { LegacyQuotationSections } from '@/components/reports/legacy-quotation-sections';

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

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
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

  const defaultRange = useMemo(() => getCurrentMonthRange(), []);
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
  const [yearlyData, setYearlyData] = useState<Array<{
    name: string;
    '2025': number;
    '2026': number;
  }> | null>(null);
  const [teuData, setTeuData] = useState<Array<{
    name: string;
    '2025': number;
    '2026': number;
  }> | null>(null);
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

  // Fetch yearly comparison data (2025 vs 2026)
  const fetchYearlyData = useCallback(async () => {
    try {
      const years = [2025, 2026];
      const yearlyByTransmode: Record<string, Record<number, number>> = {};

      for (const year of years) {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
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

      // Convert to chart data format
      const chartData = Object.entries(yearlyByTransmode)
        .map(([name, yearCounts]) => ({
          name,
          '2025': yearCounts[2025] || 0,
          '2026': yearCounts[2026] || 0,
        }))
        .sort((a, b) => b['2025'] + b['2026'] - (a['2025'] + a['2026']));

      setYearlyData(chartData);
    } catch (err) {
      console.error('Error fetching yearly data:', err);
      setYearlyData([]);
    }
  }, []);

  // Fetch TEU data (2025 vs 2026)
  const fetchTeuData = useCallback(async () => {
    try {
      const years = [2025, 2026];
      const teuByManager: Record<string, Record<number, number>> = {};

      for (const year of years) {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
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
            body.data.sales.forEach((sale: any) => {
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

      // Convert to chart data format
      const chartData = Object.entries(teuByManager).map(([name, yearCounts]) => ({
        name,
        '2025': (yearCounts[2025] as number) || 0,
        '2026': (yearCounts[2026] as number) || 0,
      }));

      setTeuData(chartData);
    } catch (err) {
      console.error('Error fetching TEU data:', err);
      setTeuData([]);
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
    fetchYearlyData();
    fetchTeuData();
  }, [
    status,
    canAccessReports,
    fetchReports,
    fetchTransmodes,
    fetchYearlyData,
    fetchTeuData,
    defaultRange.start,
    defaultRange.end,
  ]);

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

  const yearlyTotalCount = useMemo(
    () =>
      (yearlyData ?? []).reduce(
        (sum, entry) => sum + (entry['2025'] || 0) + (entry['2026'] || 0),
        0,
      ),
    [yearlyData],
  );

  const teuTotalCount = useMemo(
    () =>
      (teuData ?? []).reduce((sum, entry) => sum + (entry['2025'] || 0) + (entry['2026'] || 0), 0),
    [teuData],
  );

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
    setPendingRange(defaultRange);
    fetchReports(defaultRange);
    fetchTransmodes(defaultRange);
  };

  const handleRetry = () => {
    if (isFetching) return;
    fetchReports({ start: pendingRange.start, end: pendingRange.end });
    fetchTransmodes({ start: pendingRange.start, end: pendingRange.end });
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
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('reports.byManager.title')}
                  <span className="text-sm font-medium text-gray-500">
                    ({formatNumber(managerTotalCount)})
                  </span>
                </CardTitle>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              const params = new URLSearchParams();
                              params.set('salesManager', entry.name);
                              if (currentRange?.start) params.set('dateFrom', currentRange.start);
                              if (currentRange?.end) params.set('dateTo', currentRange.end);
                              router.push(`/quotations?${params.toString()}`);
                            }}
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Details
                          </Button>
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
                <CardTitle className="flex items-center gap-2">
                  {t('reports.transmode.title')}
                  <span className="text-sm font-medium text-gray-500">
                    ({formatNumber(transmodeTotalCount)})
                  </span>
                </CardTitle>
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

          {/* Yearly Comparison Bar Chart */}
          {yearlyData && yearlyData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('reports.yearlyComparison.title')}
                  <span className="text-sm font-medium text-gray-500">
                    ({formatNumber(yearlyTotalCount)})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatNumber(value)} />
                      <BarLegend />
                      <Bar dataKey="2025" fill="#7DD3FC" name="2025" />
                      <Bar dataKey="2026" fill="#1E40AF" name="2026" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* TEU Data by Year */}
          {teuData && teuData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('reports.teuComparison.title')}
                  <span className="text-sm font-medium text-gray-500">
                    ({formatNumber(teuTotalCount)})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teuData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatNumber(value)} />
                      <BarLegend />
                      <Bar dataKey="2025" fill="#FCA5A5" name="2025" />
                      <Bar dataKey="2026" fill="#22C55E" name="2026" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
