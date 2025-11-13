import { NextRequest, NextResponse } from 'next/server';
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

const updateSchema = z
  .object({
    month: z.string().optional(),
    salesName: z.string().min(1, 'Sales name is required').optional(),
    plannedRevenue: z.coerce.number().nonnegative().optional(),
    plannedProfit: z.coerce.number().nonnegative().optional(),
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .or(z.literal(''))
      .transform((value) => (value ? value : undefined)),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields provided for update.',
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = (await (prisma as any).salesKpiMeasurement.findUnique({
      where: { id },
    })) as SalesKpiRecord | null;
    if (!existing) {
      return NextResponse.json({ error: 'Measurement not found.' }, { status: 404 });
    }

    let monthDate = existing.month;
    if (parsed.data.month) {
      try {
        const monthInfo = parseMonthInput(parsed.data.month);
        monthDate = monthInfo.monthDate;
      } catch (error: any) {
        return NextResponse.json(
          { error: error?.message ?? 'Invalid month value.' },
          { status: 400 },
        );
      }
    }

    const salesName = parsed.data.salesName
      ? normalizeSalesName(parsed.data.salesName)
      : existing.salesName;
    const matchKey = buildSalesMatchKey(salesName);

    if (monthDate.getTime() !== existing.month.getTime() || matchKey !== existing.matchKey) {
      const duplicate = (await (prisma as any).salesKpiMeasurement.findFirst({
        where: {
          month: monthDate,
          matchKey,
          NOT: { id: existing.id },
        },
      })) as SalesKpiRecord | null;
      if (duplicate) {
        return NextResponse.json(
          { error: 'Another record already exists for this sales name and month.' },
          { status: 409 },
        );
      }
    }

    const updated = (await (prisma as any).salesKpiMeasurement.update({
      where: { id },
      data: {
        month: monthDate,
        salesName,
        matchKey,
        plannedRevenue:
          parsed.data.plannedRevenue !== undefined
            ? parsed.data.plannedRevenue
            : existing.plannedRevenue,
        plannedProfit:
          parsed.data.plannedProfit !== undefined
            ? parsed.data.plannedProfit
            : existing.plannedProfit,
        notes: parsed.data.notes !== undefined ? parsed.data.notes : existing.notes,
      },
    })) as SalesKpiRecord;

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        month: formatMonthKey(monthDate),
        salesName: updated.salesName,
        plannedRevenue: updated.plannedRevenue,
        plannedProfit: updated.plannedProfit,
        notes: updated.notes ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to update KPI measurement.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      ensureAccess(session.user.role);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await (prisma as any).salesKpiMeasurement.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to delete KPI measurement.',
        details:
          error?.code === 'P2025' ? 'Measurement not found.' : (error?.message ?? 'Unknown error'),
      },
      { status: error?.code === 'P2025' ? 404 : 500 },
    );
  }
}
