import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import {
  buildSalesMatchKey,
  formatMonthKey,
  normalizeSalesName,
  parseMonthInput,
} from '@/lib/sales-kpi';

const querySchema = z.object({
  month: z.string().optional(),
  salesName: z.string().optional(),
});

const createSchema = z.object({
  month: z.string(),
  salesName: z.string().min(1, 'Sales name is required'),
  plannedRevenue: z.coerce.number().nonnegative().default(0),
  plannedProfit: z.coerce.number().nonnegative().default(0),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
});

type SalesKpiRecord = {
  id: string;
  month: Date;
  salesName: string;
  matchKey: string;
  plannedRevenue: number;
  plannedProfit: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function ensureAccess(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  if (!hasPermission(normalized, 'accessMasterData')) {
    throw new Error('forbidden');
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      ensureAccess(session.user.role);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { month, salesName } = parsedQuery.data;

    if (salesName) {
      const normalizedSales = normalizeSalesName(salesName);
      const matchKey = buildSalesMatchKey(normalizedSales);

      const history = (await (prisma as any).salesKpiMeasurement.findMany({
        where: { matchKey },
        orderBy: [{ month: 'desc' }],
      })) as SalesKpiRecord[];

      return NextResponse.json({
        success: true,
        data: {
          salesName: normalizedSales,
          matchKey,
          measurements: history.map((item) => ({
            id: item.id,
            month: formatMonthKey(item.month),
            salesName: item.salesName,
            plannedRevenue: item.plannedRevenue,
            plannedProfit: item.plannedProfit,
            notes: item.notes ?? null,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })),
        },
      });
    }

    let monthInfo;
    try {
      monthInfo = parseMonthInput(month);
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message ?? 'Invalid month value.' },
        { status: 400 },
      );
    }

    const measurements = (await (prisma as any).salesKpiMeasurement.findMany({
      where: { month: monthInfo.monthDate },
      orderBy: [{ salesName: 'asc' }],
    })) as SalesKpiRecord[];

    const totals = measurements.reduce(
      (acc: { plannedRevenue: number; plannedProfit: number }, item) => {
        acc.plannedRevenue += item.plannedRevenue ?? 0;
        acc.plannedProfit += item.plannedProfit ?? 0;
        return acc;
      },
      { plannedRevenue: 0, plannedProfit: 0 },
    );

    return NextResponse.json({
      success: true,
      data: {
        month: monthInfo.month,
        measurements: measurements.map((item) => ({
          id: item.id,
          month: monthInfo.month,
          salesName: item.salesName,
          plannedRevenue: item.plannedRevenue,
          plannedProfit: item.plannedProfit,
          notes: item.notes ?? null,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        totals,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to load KPI measurements.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      ensureAccess(session.user.role);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    let monthInfo;
    try {
      monthInfo = parseMonthInput(parsed.data.month);
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message ?? 'Invalid month value.' },
        { status: 400 },
      );
    }

    const salesName = normalizeSalesName(parsed.data.salesName);
    const matchKey = buildSalesMatchKey(salesName);

    const existing = await (prisma as any).salesKpiMeasurement.findFirst({
      where: { month: monthInfo.monthDate, matchKey },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A KPI measurement already exists for this sales name and month.' },
        { status: 409 },
      );
    }

    const created = await (prisma as any).salesKpiMeasurement.create({
      data: {
        month: monthInfo.monthDate,
        salesName,
        matchKey,
        plannedRevenue: parsed.data.plannedRevenue ?? 0,
        plannedProfit: parsed.data.plannedProfit ?? 0,
        notes: parsed.data.notes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: created.id,
          month: formatMonthKey(created.month),
          salesName: created.salesName,
          plannedRevenue: created.plannedRevenue,
          plannedProfit: created.plannedProfit,
          notes: created.notes ?? null,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'A KPI measurement already exists for this sales name and month.',
          details: error.meta,
        },
        { status: 409 },
      );
    }

    console.error('Failed to create sales KPI measurement', error);
    return NextResponse.json(
      {
        error: 'Failed to create KPI measurement.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
