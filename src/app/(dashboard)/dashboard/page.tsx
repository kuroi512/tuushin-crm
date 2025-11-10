'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Ship, Building2, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { useT } from '@/lib/i18n';
import {
  DashboardCalendar,
  type CalendarShipment,
  type CalendarRange,
  type CalendarDay,
  type CalendarStatus,
} from '@/components/dashboard/Calendar';

interface DashboardStats {
  quotations: {
    total: number;
    draft: number;
    approved: number;
    converted: number;
  };
  shipments: {
    totalExternal: number;
    import: number;
    export: number;
    transit: number;
  };
  finance: {
    totalRevenue: number;
    currency: string | null;
    revenueBreakdown: Record<string, number>;
    profitMnt: number;
    profitFxBreakdown: Record<string, number>;
  };
}

const DEFAULT_STATS: DashboardStats = {
  quotations: { total: 0, draft: 0, approved: 0, converted: 0 },
  shipments: { totalExternal: 0, import: 0, export: 0, transit: 0 },
  finance: {
    totalRevenue: 0,
    currency: null,
    revenueBreakdown: {},
    profitMnt: 0,
    profitFxBreakdown: {},
  },
};

interface CalendarSummary {
  totalDays: number;
  totalEvents: number;
  range: { start: string; end: string; today?: string };
  statusCounts: Partial<Record<CalendarStatus, number>>;
}

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
  if (!Number.isFinite(amount)) return '—';
  if (!currency) {
    return formatNumber(amount, { maximumFractionDigits: 2 });
  }
  const code = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  const formatted = formatNumber(amount, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return symbol ? `${symbol}${formatted}` : `${code} ${formatted}`;
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

export default function DashboardPage() {
  const t = useT();
  const initialMonthValue = useMemo(() => formatMonthValue(new Date()), []);
  const currentMonthRef = useRef(initialMonthValue);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(initialMonthValue);
  const [activeRange, setActiveRange] = useState<{ start: string; end: string } | null>(null);
  const [calendarData, setCalendarData] = useState<Record<string, CalendarShipment[]>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarSummary, setCalendarSummary] = useState<CalendarSummary | null>(null);
  const [calendarRange, setCalendarRange] = useState<CalendarRange | null>(null);
  const calendarRequestId = useRef(0);

  const revenueHasBreakdown = Object.keys(stats.finance.revenueBreakdown).length > 0;
  const profitFxEntries = Object.entries(stats.finance.profitFxBreakdown).filter(
    ([currency, amount]) => currency.toUpperCase() !== 'MNT' && Number(amount) !== 0,
  ) as Array<[string, number]>;
  const profitHasFx = profitFxEntries.length > 0;

  useEffect(() => {
    let ignore = false;

    const loadMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const requestedRange = getMonthRange(selectedMonth);
        const fallbackRange = getMonthRange(currentMonthRef.current);
        const range = requestedRange ?? fallbackRange;
        if (!range) {
          throw new Error('Invalid month selection');
        }
        if (!requestedRange && fallbackRange && currentMonthRef.current !== selectedMonth) {
          setSelectedMonth(currentMonthRef.current);
          return;
        }

        const params = new URLSearchParams({ start: range.startISO, end: range.endISO });
        const res = await fetch(`/api/dashboard/metrics?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.data?.metrics) {
          throw new Error(json?.error || json?.details || 'Failed to load dashboard metrics');
        }

        if (!ignore) {
          setStats(json.data.metrics as DashboardStats);
          setActiveRange(json.data.range ?? null);
          if (json.data?.range?.start) {
            currentMonthRef.current = formatMonthValue(new Date(json.data.range.start));
          }
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.message ?? 'Failed to load dashboard metrics');
          setStats(DEFAULT_STATS);
          setActiveRange(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadMetrics();
    const interval = setInterval(loadMetrics, 5 * 60 * 1000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [selectedMonth]);

  const fetchCalendar = useCallback(async (range: CalendarRange) => {
    const requestId = ++calendarRequestId.current;
    setCalendarLoading(true);
    setCalendarError(null);

    try {
      const params = new URLSearchParams({ start: range.start, end: range.end });
      if (range.today) params.set('today', range.today);

      const res = await fetch(`/api/dashboard/calendar?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.data) {
        throw new Error(json?.error || json?.details || 'Failed to load calendar data');
      }

      if (calendarRequestId.current !== requestId) return;

      setCalendarData(json.data as Record<string, CalendarShipment[]>);
      setCalendarSummary(json.summary as CalendarSummary);
    } catch (err: any) {
      if (calendarRequestId.current !== requestId) return;
      setCalendarData({});
      setCalendarSummary(null);
      setCalendarError(err?.message ?? 'Failed to load calendar data');
    } finally {
      if (calendarRequestId.current === requestId) {
        setCalendarLoading(false);
      }
    }
  }, []);

  const handleRangeChange = useCallback(
    (range: CalendarRange) => {
      setCalendarRange(range);
      fetchCalendar(range);
    },
    [fetchCalendar],
  );

  const handleCalendarRetry = useCallback(() => {
    if (calendarRange) {
      fetchCalendar(calendarRange);
    }
  }, [calendarRange, fetchCalendar]);

  const handleDayOpen = useCallback((day: CalendarDay) => {
    console.debug('Dashboard calendar day', day);
  }, []);

  const handleMonthInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setSelectedMonth(nextValue);
      if (getMonthRange(nextValue)) {
        currentMonthRef.current = nextValue;
      }
    },
    [currentMonthRef],
  );

  const handleShiftMonth = useCallback(
    (offset: number) => {
      setSelectedMonth((prev) => {
        const next = shiftMonthValue(prev, offset, currentMonthRef.current);
        currentMonthRef.current = next;
        return next;
      });
    },
    [currentMonthRef],
  );

  const selectedMonthLabel = useMemo(() => {
    const range = getMonthRange(selectedMonth) ?? getMonthRange(currentMonthRef.current);
    if (!range) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(range.start);
  }, [selectedMonth, currentMonthRef]);

  const displayedRange = useMemo(() => {
    if (!activeRange?.start || !activeRange?.end) return null;
    const formatter = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
    return `${formatter.format(new Date(activeRange.start))} – ${formatter.format(
      new Date(activeRange.end),
    )}`;
  }, [activeRange]);

  return (
    <div className="space-y-1.5 px-2 sm:px-4 md:space-y-2 md:px-6">
      {/* KPI strip like the client's system (large) */}
      <div className="rounded-md border bg-white p-1 shadow-sm">
        <KpiStrip compact={false} />
      </div>
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-600 sm:text-base">{t('dashboard.subtitle')}</p>
        </div>
        {/* <Button className="flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          {t('dashboard.actions.newQuotation')}
        </Button> */}
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
      <Card className="border bg-white">
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Selected month
            </p>
            <p className="text-sm font-medium text-gray-900">
              {selectedMonthLabel ?? selectedMonth}
            </p>
            {displayedRange && <p className="text-xs text-gray-500">{displayedRange}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => handleShiftMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              className="w-36"
              value={selectedMonth}
              onChange={handleMonthInputChange}
              max={formatMonthValue(new Date())}
              aria-label="Select month"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => handleShiftMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.cards.quotations.title')}
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '—' : formatNumber(stats.quotations.total)}
            </div>
            <p className="text-muted-foreground text-xs">
              {loading ? '—' : formatNumber(stats.quotations.draft)}{' '}
              {t('dashboard.cards.detail.draft')},{' '}
              {loading ? '—' : formatNumber(stats.quotations.approved)}{' '}
              {t('dashboard.cards.detail.approved')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('dashboard.cards.detail.converted')}:{' '}
              {loading ? '—' : formatNumber(stats.quotations.converted)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.cards.shipments.title')}
            </CardTitle>
            <Ship className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '—' : formatNumber(stats.shipments.totalExternal)}
            </div>
            <p className="text-muted-foreground text-xs">
              {loading
                ? '—'
                : [
                    `${t('dashboard.cards.detail.transit')}: ${formatNumber(stats.shipments.transit)}`,
                    `${t('dashboard.cards.detail.import')}: ${formatNumber(stats.shipments.import)}`,
                    `${t('dashboard.cards.detail.export')}: ${formatNumber(stats.shipments.export)}`,
                  ].join(' • ')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.cards.customs.title')}
            </CardTitle>
            <Building2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading
                ? '—'
                : formatCurrencyAmount(stats.finance.totalRevenue, stats.finance.currency)}
            </div>
            <p className="text-muted-foreground text-xs">
              {loading
                ? '—'
                : revenueHasBreakdown
                  ? Object.entries(stats.finance.revenueBreakdown)
                      .map(
                        ([currency, amount]) =>
                          `${currency.toUpperCase()} ${formatNumber(amount, {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}`,
                      )
                      .join(' • ')
                  : t('dashboard.cards.detail.noRevenue')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.cards.revenue.title')}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '—' : formatCurrencyAmount(stats.finance.profitMnt, 'MNT')}
            </div>
            <p className="text-muted-foreground text-xs">
              {t('dashboard.cards.detail.profitMnt')}:{' '}
              {loading ? '—' : formatCurrencyAmount(stats.finance.profitMnt, 'MNT')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {loading
                ? '—'
                : profitHasFx
                  ? `${t('dashboard.cards.detail.fxProfit')}: ${profitFxEntries
                      .map(
                        ([currency, amount]) =>
                          `${currency.toUpperCase()} ${formatNumber(amount, {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}`,
                      )
                      .join(' • ')}`
                  : t('dashboard.cards.detail.noFxProfit')}
            </p>
          </CardContent>
        </Card>
      </div>

      {calendarError && (
        <Alert variant="destructive">
          <AlertTitle>{t('dashboard.calendar.title')}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{calendarError}</span>
            <div>
              <Button size="sm" variant="outline" onClick={handleCalendarRetry}>
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <DashboardCalendar
        data={calendarData}
        onRangeChange={handleRangeChange}
        onDayOpen={handleDayOpen}
        loading={calendarLoading}
      />

      {calendarSummary && !calendarError && (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col gap-1 p-4 text-xs sm:text-sm">
            <span>
              {t('dashboard.calendar.title')}: {calendarSummary.totalEvents}{' '}
              {calendarSummary.totalEvents === 1 ? 'entry' : 'entries'} across{' '}
              {calendarSummary.totalDays} {calendarSummary.totalDays === 1 ? 'day' : 'days'}.
            </span>
            <span>
              Range {new Date(calendarSummary.range.start).toLocaleDateString()} →{' '}
              {new Date(calendarSummary.range.end).toLocaleDateString()}
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
