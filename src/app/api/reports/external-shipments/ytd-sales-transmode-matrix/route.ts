import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import {
  getTeuWeightForExternalShipment,
  resolveReportTransmodeName,
} from '@/lib/external-shipment-transmode';

const querySchema = z.object({
  ref: z.string().optional(),
});

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

function ytdUtcRangeForCalendarYear(ref: Date, year: number): { start: Date; end: Date } {
  const month = ref.getUTCMonth();
  const day = ref.getUTCDate();
  const lastDayInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayInMonth);
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, safeDay, 23, 59, 59, 999));
  return { start, end };
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

function growthPct(prev: number, curr: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function formatPct(p: number | null) {
  if (p === null) return '#DIV/0!';
  return `${Math.round(p)}%`;
}

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

    let ref = new Date();
    if (parsed.data.ref?.trim()) {
      const d = new Date(`${parsed.data.ref.trim()}T12:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) ref = d;
    }

    const cy = ref.getUTCFullYear();
    const py = cy - 1;

    const rangePrev = ytdUtcRangeForCalendarYear(ref, py);
    const rangeCurr = ytdUtcRangeForCalendarYear(ref, cy);

    const [prevShipments, currShipments] = await Promise.all([
      prisma.externalShipment.findMany({
        where: buildDateWindowWhere(rangePrev),
        select: {
          salesManager: true,
          manager: true,
          containerWagonName: true,
          raw: true,
        },
      }),
      prisma.externalShipment.findMany({
        where: buildDateWindowWhere(rangeCurr),
        select: {
          salesManager: true,
          manager: true,
          containerWagonName: true,
          raw: true,
        },
      }),
    ]);

    type Nest = Record<string, Record<string, number>>;
    const countPy: Nest = {};
    const countCy: Nest = {};
    const teuPy: Record<string, number> = {};
    const teuCy: Record<string, number> = {};

    const bump = (nest: Nest, mgr: string, mode: string) => {
      if (!nest[mgr]) nest[mgr] = {};
      nest[mgr][mode] = (nest[mgr][mode] ?? 0) + 1;
    };

    for (const s of prevShipments) {
      const mgr = resolveSalesLabel(s);
      const mode = resolveReportTransmodeName(s);
      bump(countPy, mgr, mode);
      const teu = getTeuWeightForExternalShipment(s);
      teuPy[mgr] = (teuPy[mgr] ?? 0) + teu;
    }

    for (const s of currShipments) {
      const mgr = resolveSalesLabel(s);
      const mode = resolveReportTransmodeName(s);
      bump(countCy, mgr, mode);
      const teu = getTeuWeightForExternalShipment(s);
      teuCy[mgr] = (teuCy[mgr] ?? 0) + teu;
    }

    const managerSet = new Set<string>([...Object.keys(countPy), ...Object.keys(countCy)]);
    const managers = Array.from(managerSet).sort((a, b) =>
      a.localeCompare(b, 'mn', { sensitivity: 'base' }),
    );

    const modeSet = new Set<string>();
    for (const m of managers) {
      if (countPy[m]) Object.keys(countPy[m]).forEach((k) => modeSet.add(k));
      if (countCy[m]) Object.keys(countCy[m]).forEach((k) => modeSet.add(k));
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
    for (const x of [...modeSet].sort((a, b) => a.localeCompare(b))) {
      if (!used.has(x)) {
        orderedModes.push(x);
        used.add(x);
      }
    }

    const modeRows = orderedModes.map((mode) => {
      const byManager = managers.map((mgr) => ({
        prev: countPy[mgr]?.[mode] ?? 0,
        curr: countCy[mgr]?.[mode] ?? 0,
      }));
      const sumPrev = byManager.reduce((s, c) => s + c.prev, 0);
      const sumCurr = byManager.reduce((s, c) => s + c.curr, 0);
      return {
        mode,
        byManager,
        sumPrev,
        sumCurr,
        growthPct: formatPct(growthPct(sumPrev, sumCurr)),
      };
    });

    const totalsByManager = managers.map((mgr) => {
      let p = 0;
      let c = 0;
      for (const mode of orderedModes) {
        p += countPy[mgr]?.[mode] ?? 0;
        c += countCy[mgr]?.[mode] ?? 0;
      }
      return { prev: p, curr: c };
    });

    const teuByManager = managers.map((mgr) => ({
      prev: teuPy[mgr] ?? 0,
      curr: teuCy[mgr] ?? 0,
    }));

    const grandPrev = totalsByManager.reduce((s, x) => s + x.prev, 0);
    const grandCurr = totalsByManager.reduce((s, x) => s + x.curr, 0);
    const grandTeuPrev = teuByManager.reduce((s, x) => s + x.prev, 0);
    const grandTeuCurr = teuByManager.reduce((s, x) => s + x.curr, 0);

    return NextResponse.json({
      success: true,
      data: {
        referenceDate: toIsoDate(ref),
        previousYear: py,
        currentYear: cy,
        previousRange: { start: toIsoDate(rangePrev.start), end: toIsoDate(rangePrev.end) },
        currentRange: { start: toIsoDate(rangeCurr.start), end: toIsoDate(rangeCurr.end) },
        managers,
        modeRows,
        totalsByManager,
        teuByManager,
        grandTotals: {
          prev: grandPrev,
          curr: grandCurr,
          growthPct: formatPct(growthPct(grandPrev, grandCurr)),
        },
        grandTeu: {
          prev: grandTeuPrev,
          curr: grandTeuCurr,
          growthPct: formatPct(growthPct(grandTeuPrev, grandTeuCurr)),
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message ?? 'Failed to load sales transmode matrix' },
      { status: 500 },
    );
  }
}
