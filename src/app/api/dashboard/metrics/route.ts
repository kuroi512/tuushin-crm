import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { ACTIVE_STATUSES, normalizeAppQuotationStatus } from '@/lib/quotations/status';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessDashboard')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: any = {};
    if (!hasPermission(role, 'viewAllQuotations')) {
      const scoped: any[] = [];
      if (session.user.email) scoped.push({ createdBy: session.user.email });
      if (session.user.id) {
        scoped.push({ payload: { path: ['salesManagerId'], equals: session.user.id } });
      }
      if (scoped.length > 0) {
        where.OR = scoped;
      } else {
        where.createdBy = session.user.email ?? '__unknown__';
      }
    }

    const [
      quotations,
      shipmentsByCategory,
      financeAggregates,
      revenueByCurrency,
      profitFxByCurrency,
    ] = await Promise.all([
      prisma.appQuotation.findMany({
        where,
        select: {
          status: true,
        },
      }),
      prisma.externalShipment.groupBy({
        by: ['category'],
        _count: { _all: true },
      }),
      prisma.externalShipment.aggregate({
        _sum: {
          totalAmount: true,
          profitMnt: true,
        },
      }),
      prisma.externalShipment.groupBy({
        by: ['currencyCode'],
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.externalShipment.groupBy({
        by: ['currencyCode'],
        _sum: {
          profitCurrency: true,
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const quotation of quotations) {
      const status = normalizeAppQuotationStatus(quotation.status);
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    }

    const activeTotal = Array.from(ACTIVE_STATUSES).reduce(
      (sum, status) => sum + (statusCounts[status] ?? 0),
      0,
    );
    const draftCount = (statusCounts.CREATED ?? 0) + (statusCounts.QUOTATION ?? 0);
    const confirmedCount = statusCounts.CONFIRMED ?? 0;
    const convertedCount = (statusCounts.RELEASED ?? 0) + (statusCounts.CLOSED ?? 0);

    const shipmentCounts = {
      totalExternal: 0,
      import: 0,
      export: 0,
      transit: 0,
    };

    for (const entry of shipmentsByCategory) {
      const count = entry._count?._all ?? 0;
      shipmentCounts.totalExternal += count;

      switch (entry.category) {
        case 'IMPORT':
          shipmentCounts.import = count;
          break;
        case 'EXPORT':
          shipmentCounts.export = count;
          break;
        case 'TRANSIT':
          shipmentCounts.transit = count;
          break;
        default:
          break;
      }
    }

    const revenueBreakdown: Record<string, number> = {};
    const profitFxBreakdown: Record<string, number> = {};

    for (const entry of revenueByCurrency) {
      const rawCode = entry.currencyCode?.toUpperCase();
      const code = rawCode && rawCode.trim().length > 0 ? rawCode : 'MNT';
      const revenue = Number(entry._sum?.totalAmount ?? 0);
      if (Number.isFinite(revenue)) {
        revenueBreakdown[code] = revenue;
      }
    }

    for (const entry of profitFxByCurrency) {
      const rawCode = entry.currencyCode?.toUpperCase();
      const code = rawCode && rawCode.trim().length > 0 ? rawCode : 'MNT';
      const profitFx = Number(entry._sum?.profitCurrency ?? 0);
      if (Number.isFinite(profitFx)) {
        profitFxBreakdown[code] = profitFx;
      }
    }

    const totalRevenue = Number(financeAggregates._sum?.totalAmount ?? 0);
    const totalProfitMnt = Number(financeAggregates._sum?.profitMnt ?? 0);
    const revenueCurrency =
      revenueBreakdown.MNT !== undefined
        ? 'MNT'
        : (Object.keys(revenueBreakdown)[0] ?? (totalRevenue ? 'MNT' : null));

    return NextResponse.json({
      data: {
        quotations: {
          total: activeTotal,
          draft: draftCount,
          approved: confirmedCount,
          converted: convertedCount,
        },
        shipments: {
          totalExternal: shipmentCounts.totalExternal,
          import: shipmentCounts.import,
          export: shipmentCounts.export,
          transit: shipmentCounts.transit,
        },
        finance: {
          totalRevenue,
          currency: revenueCurrency,
          revenueBreakdown,
          profitMnt: totalProfitMnt,
          profitFxBreakdown,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to load dashboard metrics.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
