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

    const quotations = await prisma.appQuotation.findMany({
      where,
      select: {
        status: true,
        payload: true,
      },
    });

    const statusCounts: Record<string, number> = {};
    const profitBreakdown: Record<string, number> = {};

    for (const quotation of quotations) {
      const status = normalizeAppQuotationStatus(quotation.status);
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;

      const payload = (quotation.payload ?? {}) as Record<string, any>;
      const profit = payload?.profit;
      if (profit && typeof profit.amount !== 'undefined') {
        const amount = Number(profit.amount);
        if (Number.isFinite(amount)) {
          const currency =
            typeof profit.currency === 'string' ? profit.currency.toUpperCase() : 'MNT';
          profitBreakdown[currency] = (profitBreakdown[currency] ?? 0) + amount;
        }
      }
    }

    const activeTotal = Array.from(ACTIVE_STATUSES).reduce(
      (sum, status) => sum + (statusCounts[status] ?? 0),
      0,
    );
    const draftCount = (statusCounts.CREATED ?? 0) + (statusCounts.QUOTATION ?? 0);
    const confirmedCount = statusCounts.CONFIRMED ?? 0;
    const convertedCount = (statusCounts.RELEASED ?? 0) + (statusCounts.CLOSED ?? 0);

    const shipmentsInTransit = statusCounts.ONGOING ?? 0;
    const shipmentsDelivered = (statusCounts.RELEASED ?? 0) + (statusCounts.CLOSED ?? 0);
    const shipmentsWaiting = statusCounts.ARRIVED ?? 0;
    const customsPending = statusCounts.ARRIVED ?? 0;
    const customsProcessing = statusCounts.CONFIRMED ?? 0;
    const customsCleared = shipmentsDelivered;

    const profitKeys = Object.keys(profitBreakdown);
    const primaryCurrency = profitBreakdown.MNT !== undefined ? 'MNT' : (profitKeys[0] ?? null);
    const totalProfit = primaryCurrency ? profitBreakdown[primaryCurrency] : 0;

    return NextResponse.json({
      data: {
        quotations: {
          total: activeTotal,
          draft: draftCount,
          approved: confirmedCount,
          converted: convertedCount,
        },
        shipments: {
          total: shipmentsInTransit + shipmentsWaiting + shipmentsDelivered,
          inTransit: shipmentsInTransit,
          delivered: shipmentsDelivered,
          delayed: shipmentsWaiting,
        },
        customs: {
          pending: customsPending,
          cleared: customsCleared,
          processing: customsProcessing,
        },
        finance: {
          totalProfit,
          currency: primaryCurrency,
          breakdown: profitBreakdown,
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
