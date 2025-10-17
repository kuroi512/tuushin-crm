import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

function safeNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export async function GET() {
  try {
    const now = Date.now();
    const weekAgo = new Date(now - ONE_WEEK_MS);
    const monthAgo = new Date(now - THIRTY_DAYS_MS);

    const [
      quotationTotals,
      quotationDraft,
      quotationApproved,
      quotationConverted,
      externalTotals,
      externalInTransit,
      externalDelivered,
      externalDelayed,
      customsPending,
      customsCleared,
      customsProcessing,
      financeAggregates,
      financePendingInvoices,
      financePaidInvoices,
      financeOverdue,
    ] = await Promise.all([
      prisma.quotation.count(),
      prisma.quotation.count({ where: { status: 'DRAFT' } }),
      prisma.quotation.count({ where: { status: 'CONFIRMED' } }),
      prisma.quotation.count({ where: { shipments: { some: {} } } }),
      prisma.externalShipment.count(),
      prisma.externalShipment.count({ where: { arrivalAt: null } }),
      prisma.externalShipment.count({ where: { arrivalAt: { not: null } } }),
      prisma.externalShipment.count({ where: { arrivalAt: null, registeredAt: { lt: weekAgo } } }),
      prisma.externalShipment.count({ where: { category: 'IMPORT', arrivalAt: null } }),
      prisma.externalShipment.count({ where: { category: 'IMPORT', arrivalAt: { not: null } } }),
      prisma.externalShipment.count({
        where: {
          category: 'IMPORT',
          transitEntryAt: { not: null },
          arrivalAt: null,
        },
      }),
      prisma.externalShipment.aggregate({
        _sum: {
          totalAmount: true,
          profitMnt: true,
          profitCurrency: true,
        },
      }),
      prisma.externalShipment.count({
        where: { paymentType: { equals: 'Collect', mode: 'insensitive' } },
      }),
      prisma.externalShipment.count({
        where: { paymentType: { equals: 'Prepaid', mode: 'insensitive' } },
      }),
      prisma.externalShipment.count({
        where: {
          paymentType: { equals: 'Collect', mode: 'insensitive' },
          registeredAt: { lt: monthAgo },
          arrivalAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        quotations: {
          total: quotationTotals,
          draft: quotationDraft,
          approved: quotationApproved,
          converted: quotationConverted,
        },
        shipments: {
          total: externalTotals,
          inTransit: externalInTransit,
          delivered: externalDelivered,
          delayed: externalDelayed,
        },
        customs: {
          pending: customsPending,
          cleared: customsCleared,
          processing: customsProcessing,
        },
        finance: {
          totalRevenue: safeNumber(financeAggregates._sum.totalAmount),
          pendingInvoices: financePendingInvoices,
          paidInvoices: financePaidInvoices,
          overduePayments: financeOverdue,
          profitMnt: safeNumber(financeAggregates._sum.profitMnt),
          profitCurrency: safeNumber(financeAggregates._sum.profitCurrency),
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
