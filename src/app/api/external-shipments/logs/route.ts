import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    let limit = Number.parseInt(limitParam ?? '20', 10);
    if (Number.isNaN(limit) || limit <= 0) {
      limit = 20;
    }
    limit = Math.min(limit, 100);

    const db = prisma as any;
    const logs = await db.externalShipmentSyncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { shipments: true } },
      },
    });

    const data = logs.map((log: any) => ({
      id: log.id,
      category: log.category,
      filterType: log.filterType ?? null,
      fromDate: log.fromDate ? log.fromDate.toISOString() : null,
      toDate: log.toDate ? log.toDate.toISOString() : null,
      recordCount: log.recordCount ?? 0,
      shipmentCount: log._count?.shipments ?? log.recordCount ?? 0,
      totalAmount: log.totalAmount ?? 0,
      totalProfitMnt: log.totalProfitMnt ?? 0,
      totalProfitCur: log.totalProfitCur ?? 0,
      startedAt: log.startedAt ? log.startedAt.toISOString() : null,
      finishedAt: log.finishedAt ? log.finishedAt.toISOString() : null,
      status: log.status,
      message: log.message ?? null,
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return NextResponse.json(
        {
          data: [],
          warning:
            'External shipment tables are missing. Run `pnpm prisma db push` (or apply the latest migrations) to provision them.',
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        error: 'Failed to load external shipment sync logs.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
