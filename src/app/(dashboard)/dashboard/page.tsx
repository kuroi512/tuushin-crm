'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FileText, Ship, Building2, DollarSign } from 'lucide-react';
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
    total: number;
    inTransit: number;
    delivered: number;
    delayed: number;
  };
  customs: {
    pending: number;
    cleared: number;
    processing: number;
  };
  finance: {
    totalProfit: number;
    currency: string | null;
    breakdown: Record<string, number>;
  };
}

interface CalendarSummary {
  totalDays: number;
  totalEvents: number;
  range: { start: string; end: string; today?: string };
  statusCounts: Partial<Record<CalendarStatus, number>>;
}

const DEFAULT_STATS: DashboardStats = {
  quotations: { total: 0, draft: 0, approved: 0, converted: 0 },
  shipments: { total: 0, inTransit: 0, delivered: 0, delayed: 0 },
  customs: { pending: 0, cleared: 0, processing: 0 },
  finance: { totalProfit: 0, currency: null, breakdown: {} },
};

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

export default function DashboardPage() {
  const t = useT();
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarData, setCalendarData] = useState<Record<string, CalendarShipment[]>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarSummary, setCalendarSummary] = useState<CalendarSummary | null>(null);
  const [calendarRange, setCalendarRange] = useState<CalendarRange | null>(null);
  const calendarRequestId = useRef(0);

  const financeHasProfit = Object.keys(stats.finance.breakdown).length > 0;

  useEffect(() => {
    let ignore = false;

    const loadMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/dashboard/metrics', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json?.data) {
          throw new Error(json?.error || json?.details || 'Failed to load dashboard metrics');
        }
        if (!ignore) {
          setStats(json.data as DashboardStats);
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.message ?? 'Failed to load dashboard metrics');
          setStats(DEFAULT_STATS);
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
  }, []);

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
              {loading ? '—' : formatNumber(stats.shipments.inTransit)}
            </div>
            <p className="text-muted-foreground text-xs">
              {loading ? '—' : formatNumber(stats.shipments.total)}{' '}
              {t('dashboard.cards.detail.totalShipments')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('dashboard.cards.detail.delivered')}:{' '}
              {loading ? '—' : formatNumber(stats.shipments.delivered)} •{' '}
              {t('dashboard.cards.detail.delayed')}:{' '}
              {loading ? '—' : formatNumber(stats.shipments.delayed)}
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
              {loading ? '—' : formatNumber(stats.customs.pending)}
            </div>
            <p className="text-muted-foreground text-xs">
              {t('dashboard.cards.detail.processing')}:{' '}
              {loading ? '—' : formatNumber(stats.customs.processing)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('dashboard.cards.detail.cleared')}:{' '}
              {loading ? '—' : formatNumber(stats.customs.cleared)}
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
              {loading
                ? '—'
                : financeHasProfit
                  ? formatCurrencyAmount(stats.finance.totalProfit, stats.finance.currency)
                  : '—'}
            </div>
            <p className="text-muted-foreground text-xs">
              {loading
                ? '—'
                : (() => {
                    const entries = Object.entries(stats.finance.breakdown);
                    if (!entries.length) return t('dashboard.cards.detail.noProfit');
                    return entries
                      .map(
                        ([currency, amount]) =>
                          `${currency.toUpperCase()} ${formatNumber(amount, {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}`,
                      )
                      .join(' • ');
                  })()}
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
