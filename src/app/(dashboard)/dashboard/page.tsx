'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Ship,
  Building2,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { useT } from '@/lib/i18n';

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
  };
}

export default function DashboardPage() {
  const t = useT();

  const stats = useMemo<DashboardStats>(
    () => ({
      quotations: { total: 45, draft: 12, approved: 18, converted: 15 },
      shipments: { total: 32, inTransit: 14, delivered: 16, delayed: 2 },
      customs: { pending: 8, cleared: 24, processing: 5 },
      finance: {
        totalRevenue: 125000,
        pendingInvoices: 8,
        paidInvoices: 28,
        overduePayments: 3,
      },
    }),
    [],
  );

  const recentActivities = useMemo(
    () => [
      {
        id: 1,
        type: 'quotation',
        title: t('dashboard.activities.newQuotation.title'),
        description: t('dashboard.activities.newQuotation.description'),
        time: t('dashboard.activities.time.2minutes'),
        status: 'draft',
      },
      {
        id: 2,
        type: 'shipment',
        title: t('dashboard.activities.shipmentArrived.title'),
        description: t('dashboard.activities.shipmentArrived.description'),
        time: t('dashboard.activities.time.1hour'),
        status: 'completed',
      },
      {
        id: 3,
        type: 'customs',
        title: t('dashboard.activities.customsCleared.title'),
        description: t('dashboard.activities.customsCleared.description'),
        time: t('dashboard.activities.time.3hours'),
        status: 'cleared',
      },
      {
        id: 4,
        type: 'finance',
        title: t('dashboard.activities.invoicePaid.title'),
        description: t('dashboard.activities.invoicePaid.description'),
        time: t('dashboard.activities.time.5hours'),
        status: 'paid',
      },
    ],
    [t],
  );

  const statusLabels: Record<string, string> = {
    draft: t('dashboard.statusLabels.draft'),
    completed: t('dashboard.statusLabels.completed'),
    cleared: t('dashboard.statusLabels.cleared'),
    paid: t('dashboard.statusLabels.paid'),
  };

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
        <Button className="flex w-full items-center justify-center gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          {t('dashboard.actions.newQuotation')}
        </Button>
      </div>

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
            <div className="text-2xl font-bold">{stats.quotations.total}</div>
            <p className="text-muted-foreground text-xs">
              {stats.quotations.draft} {t('dashboard.cards.detail.draft')},{' '}
              {stats.quotations.approved} {t('dashboard.cards.detail.approved')}
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
            <div className="text-2xl font-bold">{stats.shipments.inTransit}</div>
            <p className="text-muted-foreground text-xs">
              {stats.shipments.total} {t('dashboard.cards.detail.totalShipments')}
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
            <div className="text-2xl font-bold">{stats.customs.pending}</div>
            <p className="text-muted-foreground text-xs">
              {stats.customs.processing} {t('dashboard.cards.detail.processing')}
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
            <div className="text-2xl font-bold">${stats.finance.totalRevenue.toLocaleString()}</div>
            <p className="text-muted-foreground text-xs">
              {stats.finance.pendingInvoices} {t('dashboard.cards.detail.pendingInvoices')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Overview */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.workflow.title')}</CardTitle>
            <CardDescription>{t('dashboard.workflow.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">
                    {t('dashboard.workflow.quotations.title')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {stats.quotations.draft} {t('dashboard.workflow.quotations.detail')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">{stats.quotations.draft}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
              <div className="flex items-center space-x-3">
                <Ship className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">
                    {t('dashboard.workflow.shipments.title')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {stats.shipments.inTransit} {t('dashboard.workflow.shipments.detail')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{stats.shipments.inTransit}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-orange-50 p-3">
              <div className="flex items-center space-x-3">
                <Building2 className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-gray-900">
                    {t('dashboard.workflow.customs.title')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {stats.customs.pending} {t('dashboard.workflow.customs.detail')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">{stats.customs.pending}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-purple-50 p-3">
              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">
                    {t('dashboard.workflow.finance.title')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {stats.finance.overduePayments} {t('dashboard.workflow.finance.detail')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{stats.finance.paidInvoices}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.activities.title')}</CardTitle>
            <CardDescription>{t('dashboard.activities.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-2 rounded-lg border p-2">
                  <div
                    className={`rounded-full p-2 ${
                      activity.type === 'quotation'
                        ? 'bg-blue-100'
                        : activity.type === 'shipment'
                          ? 'bg-green-100'
                          : activity.type === 'customs'
                            ? 'bg-orange-100'
                            : 'bg-purple-100'
                    }`}
                  >
                    {activity.type === 'quotation' && (
                      <FileText className="h-4 w-4 text-blue-600" />
                    )}
                    {activity.type === 'shipment' && <Ship className="h-4 w-4 text-green-600" />}
                    {activity.type === 'customs' && (
                      <Building2 className="h-4 w-4 text-orange-600" />
                    )}
                    {activity.type === 'finance' && (
                      <DollarSign className="h-4 w-4 text-purple-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                    <p className="mt-1 text-xs text-gray-400">{activity.time}</p>
                  </div>
                  <div
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      activity.status === 'draft'
                        ? 'bg-yellow-100 text-yellow-800'
                        : activity.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : activity.status === 'cleared'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {statusLabels[activity.status] ?? activity.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickActions.title')}</CardTitle>
          <CardDescription>{t('dashboard.quickActions.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            <a href="/quotations/new">
              <Button variant="outline" className="h-16 w-full flex-col space-y-1">
                <FileText className="h-6 w-6" />
                <span>{t('dashboard.quickActions.createQuotation')}</span>
              </Button>
            </a>
            <Button variant="outline" className="h-16 flex-col space-y-1">
              <Building2 className="h-6 w-6" />
              <span>{t('dashboard.quickActions.customsStatus')}</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col space-y-1">
              <DollarSign className="h-6 w-6" />
              <span>{t('dashboard.quickActions.generateInvoice')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
