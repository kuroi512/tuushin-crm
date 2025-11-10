import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { ACTIVE_STATUSES, normalizeAppQuotationStatus } from '@/lib/quotations/status';

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function parseDateInput(value: string | null, fallback: Date, isEnd = false) {
  if (!value) return isEnd ? endOfDay(fallback) : startOfDay(fallback);

  const trimmed = value.trim();
  if (!trimmed) return isEnd ? endOfDay(fallback) : startOfDay(fallback);

  // Accept yyyy-mm and yyyy-mm-dd formats
  const monthMatch = /^\d{4}-\d{2}$/.exec(trimmed);
  if (monthMatch) {
    const [yearStr, monthStr] = trimmed.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
      return isEnd ? endOfDay(fallback) : startOfDay(fallback);
    }
    const base = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    return isEnd ? endOfMonth(base) : startOfMonth(base);
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return isEnd ? endOfDay(fallback) : startOfDay(fallback);
  }
  return isEnd ? endOfDay(date) : startOfDay(date);
}

function startOfDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

function endOfDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

function normalizeRange(startValue: string | null, endValue: string | null) {
  const now = new Date();
  const defaultStart = startOfMonth(now);
  const defaultEnd = endOfMonth(now);

  let start = parseDateInput(startValue, defaultStart, false);
  let end = parseDateInput(endValue, defaultEnd, true);

  if (start.getTime() > end.getTime()) {
    [start, end] = [startOfDay(end), endOfDay(start)];
  }

  return {
    start,
    end,
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const range = normalizeRange(url.searchParams.get('start'), url.searchParams.get('end'));

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessDashboard')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: any = {
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    };
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

    const shipmentDateFilter = {
      OR: [
        {
          registeredAt: {
            gte: range.start,
            lte: range.end,
          },
        },
        {
          arrivalAt: {
            gte: range.start,
            lte: range.end,
          },
        },
        {
          transitEntryAt: {
            gte: range.start,
            lte: range.end,
          },
        },
      ],
    };

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
        where: shipmentDateFilter,
        _count: { _all: true },
      }),
      prisma.externalShipment.aggregate({
        where: shipmentDateFilter,
        _sum: {
          totalAmount: true,
          profitMnt: true,
        },
      }),
      prisma.externalShipment.groupBy({
        by: ['currencyCode'],
        where: shipmentDateFilter,
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.externalShipment.groupBy({
        by: ['currencyCode'],
        where: shipmentDateFilter,
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
        range: {
          start: range.startISO,
          end: range.endISO,
        },
        metrics: {
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
