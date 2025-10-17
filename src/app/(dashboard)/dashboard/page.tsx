'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Ship, Building2, DollarSign } from 'lucide-react';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { useT } from '@/lib/i18n';
import {
  DashboardCalendar,
  type CalendarShipment,
  type CalendarRange,
  type CalendarDay,
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
    totalRevenue: number;
    pendingInvoices: number;
    paidInvoices: number;
    overduePayments: number;
    profitMnt?: number;
    profitCurrency?: number;
  };
}

const DEFAULT_STATS: DashboardStats = {
  quotations: { total: 0, draft: 0, approved: 0, converted: 0 },
  shipments: { total: 0, inTransit: 0, delivered: 0, delayed: 0 },
  customs: { pending: 0, cleared: 0, processing: 0 },
  finance: { totalRevenue: 0, pendingInvoices: 0, paidInvoices: 0, overduePayments: 0 },
};

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function DashboardPage() {
  const t = useT();
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const calendarData = useMemo<Record<string, CalendarShipment[]>>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const format = (day: number) =>
      `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      [format(2)]: [
        {
          id: 'SHP-4010',
          code: 'SHP-4010',
          status: 'CREATED',
          title: 'Rail departure confirmed',
          description: 'UB terminal loading completed',
          time: '09:30',
        },
        {
          id: 'SHP-4011',
          code: 'SHP-4011',
          status: 'CONFIRMED',
          title: 'Delivered to consignee',
          time: '15:10',
        },
      ],
      [format(5)]: [
        {
          id: 'SHP-4013',
          code: 'SHP-4013',
          status: 'CONFIRMED',
          title: 'ETA Tianjin port',
          description: 'Awaiting customs clearance window',
        },
      ],
      [format(12)]: [
        {
          id: 'SHP-4024',
          code: 'SHP-4024',
          status: 'CREATED',
          title: 'Release order issued',
          time: '11:45',
        },
        {
          id: 'SHP-4025',
          code: 'SHP-4025',
          status: 'CONFIRMED',
        },
        {
          id: 'SHP-4026',
          code: 'SHP-4026',
          status: 'CANCELLED',
        },
      ],
    };
  }, []);

  const handleRangeChange = useCallback((range: CalendarRange) => {
    console.debug('Dashboard calendar range', range);
  }, []);

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
              ₮{loading ? '—' : formatNumber(stats.finance.totalRevenue)}
            </div>
            <p className="text-muted-foreground text-xs">
              {loading ? '—' : formatNumber(stats.finance.pendingInvoices)}{' '}
              {t('dashboard.cards.detail.pendingInvoices')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('dashboard.cards.detail.paidInvoices')}:{' '}
              {loading ? '—' : formatNumber(stats.finance.paidInvoices)} •{' '}
              {t('dashboard.cards.detail.overduePayments')}:{' '}
              {loading ? '—' : formatNumber(stats.finance.overduePayments)}
            </p>
            {(stats.finance.profitMnt || stats.finance.profitCurrency) && (
              <p className="text-muted-foreground mt-1 text-xs">
                {t('dashboard.cards.detail.profit')}: ₮
                {loading ? '—' : formatNumber(stats.finance.profitMnt ?? 0)} • FX{' '}
                {loading
                  ? '—'
                  : formatNumber(stats.finance.profitCurrency ?? 0, { maximumFractionDigits: 2 })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <DashboardCalendar
        data={calendarData}
        onRangeChange={handleRangeChange}
        onFetch={() => console.debug('Dashboard calendar fetch triggered')}
        onDayOpen={handleDayOpen}
      />
    </div>
  );
}
