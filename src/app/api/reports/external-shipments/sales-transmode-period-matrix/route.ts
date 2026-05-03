import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { resolveReportTransmodeName } from '@/lib/external-shipment-transmode';

const querySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const DEFAULT_DAY_RANGE = 30;

function normalizeDateRange(startInput?: string, endInput?: string) {
  const now = new Date();
  const defaultEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
  const defaultStart = new Date(defaultEnd);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - (DEFAULT_DAY_RANGE - 1));

  const parse = (value?: string, isStart?: boolean) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(isStart ? `${trimmed}T00:00:00.000Z` : `${trimmed}T23:59:59.999Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const parsedStart = parse(startInput, true) ?? defaultStart;
  const parsedEnd = parse(endInput, false) ?? defaultEnd;

  if (parsedStart.getTime() > parsedEnd.getTime()) {
    return { start: parsedEnd, end: parsedStart };
  }

  return { start: parsedStart, end: parsedEnd };
}

function buildDateWindowWhere(range: {
  start: Date;
  end: Date;
}): Prisma.ExternalShipmentWhereInput {
  return {
    OR: [
      { registeredAt: { gte: range.start, lte: range.end } },
      { arrivalAt: { gte: range.start, lte: range.end } },
      { transitEntryAt: { gte: range.start, lte: range.end } },
      {
        AND: [
          { registeredAt: { equals: null } },
          { arrivalAt: { equals: null } },
          { transitEntryAt: { equals: null } },
          { syncedAt: { gte: range.start, lte: range.end } },
        ],
      },
    ],
  };
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function normalizeDisplayName(raw?: string | null) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

function resolveSalesLabel(shipment: { salesManager: string | null; manager: string | null }) {
  const primary = normalizeDisplayName(shipment.salesManager);
  if (primary) return primary;
  const fallback = normalizeDisplayName(shipment.manager);
  if (fallback) return fallback;
  return 'Unassigned';
}

const PRIMARY_ROW_ORDER = ["20'", "40'", 'FTL', 'LTL', 'LCL', 'Air', 'Truck', 'Vagon'];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessReports')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const { start, end } = normalizeDateRange(parsed.data.start, parsed.data.end);

    const shipments = await prisma.externalShipment.findMany({
      where: buildDateWindowWhere({ start, end }),
      select: {
        salesManager: true,
        manager: true,
        containerWagonName: true,
        raw: true,
      },
    });

    type Nest = Record<string, Record<string, number>>;
    const nest: Nest = {};

    for (const s of shipments) {
      const mgr = resolveSalesLabel(s);
      const mode = resolveReportTransmodeName(s);
      if (!nest[mgr]) nest[mgr] = {};
      nest[mgr][mode] = (nest[mgr][mode] ?? 0) + 1;
    }

    const modeSet = new Set<string>();
    for (const modes of Object.values(nest)) {
      Object.keys(modes).forEach((k) => modeSet.add(k));
    }

    const orderedModes: string[] = [];
    const used = new Set<string>();
    for (const label of PRIMARY_ROW_ORDER) {
      const match = [...modeSet].find(
        (x) => x === label || x.toLowerCase() === label.toLowerCase(),
      );
      if (match && !used.has(match)) {
        orderedModes.push(match);
        used.add(match);
      }
    }
    for (const x of [...modeSet].sort((a, b) =>
      a.localeCompare(b, 'mn', { sensitivity: 'base' }),
    )) {
      if (!used.has(x)) {
        orderedModes.push(x);
        used.add(x);
      }
    }

    const displayModes = orderedModes.length > 0 ? orderedModes : [...PRIMARY_ROW_ORDER];

    const managers = Object.keys(nest).sort((a, b) =>
      a.localeCompare(b, 'mn', { sensitivity: 'base' }),
    );

    const rows = managers.map((manager) => {
      const byMode = nest[manager] ?? {};
      let total = 0;
      const counts: Record<string, number> = {};
      for (const mode of displayModes) {
        const n = byMode[mode] ?? 0;
        counts[mode] = n;
        total += n;
      }
      return { manager, counts, total };
    });

    const columnTotals: Record<string, number> = {};
    for (const mode of displayModes) {
      columnTotals[mode] = rows.reduce((sum, r) => sum + (r.counts[mode] ?? 0), 0);
    }
    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

    return NextResponse.json({
      success: true,
      data: {
        range: { start: toIsoDate(start), end: toIsoDate(end) },
        modes: displayModes,
        rows,
        columnTotals,
        grandTotal,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load period matrix';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
