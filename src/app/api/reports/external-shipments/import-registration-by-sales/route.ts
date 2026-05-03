import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import {
  classifyBorderPointDirection,
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

type ShipmentRow = {
  salesManager: string | null;
  manager: string | null;
  borderPointName: string | null;
  containerWagonName: string | null;
  raw: Prisma.JsonValue | null;
};

function aggregatePeriod(shipments: ShipmentRow[], managersOrdered: string[]) {
  type Cell = { urd: number; hoid: number };
  const modeMap = new Map<string, Map<string, Cell>>();
  const rowTeu = new Map<string, number>();
  const mgrTeu = new Map<string, number>();

  const ensureMode = (mode: string) => {
    if (!modeMap.has(mode)) modeMap.set(mode, new Map());
    return modeMap.get(mode)!;
  };

  for (const s of shipments) {
    const mgr = resolveSalesLabel(s);
    const mode = resolveReportTransmodeName(s);
    const dir = classifyBorderPointDirection(s.borderPointName);
    const teu = getTeuWeightForExternalShipment(s);

    const mCells = ensureMode(mode);
    if (!mCells.has(mgr)) mCells.set(mgr, { urd: 0, hoid: 0 });
    const cell = mCells.get(mgr)!;
    if (dir === 'urd') cell.urd += 1;
    else if (dir === 'hoid') cell.hoid += 1;

    rowTeu.set(mode, (rowTeu.get(mode) ?? 0) + teu);
    mgrTeu.set(mgr, (mgrTeu.get(mgr) ?? 0) + teu);
  }

  const modeSet = new Set(modeMap.keys());
  const orderedModes: string[] = [];
  const used = new Set<string>();
  for (const label of PRIMARY_ROW_ORDER) {
    const match = [...modeSet].find((x) => x === label || x.toLowerCase() === label.toLowerCase());
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
    const grid = modeMap.get(mode)!;
    const cells = managersOrdered.map((mgr) => {
      const c = grid.get(mgr);
      return { urd: c?.urd ?? 0, hoid: c?.hoid ?? 0 };
    });
    const sumUrd = cells.reduce((s, c) => s + c.urd, 0);
    const sumHoid = cells.reduce((s, c) => s + c.hoid, 0);
    return {
      mode,
      cells,
      sumUrd,
      sumHoid,
      rowTeu: rowTeu.get(mode) ?? 0,
    };
  });

  const footerCounts = managersOrdered.map((mgr) => {
    let urd = 0;
    let hoid = 0;
    for (const mode of orderedModes) {
      const c = modeMap.get(mode)?.get(mgr);
      if (c) {
        urd += c.urd;
        hoid += c.hoid;
      }
    }
    return { urd, hoid };
  });

  const footerSumUrd = footerCounts.reduce((s, c) => s + c.urd, 0);
  const footerSumHoid = footerCounts.reduce((s, c) => s + c.hoid, 0);
  const footerTeuByManager = managersOrdered.map((mgr) => mgrTeu.get(mgr) ?? 0);
  const grandTeu = orderedModes.reduce((s, mode) => s + (rowTeu.get(mode) ?? 0), 0);

  return {
    modeRows,
    footerCounts,
    footerSumUrd,
    footerSumHoid,
    footerTeuByManager,
    grandTeu,
  };
}

function growthPct(prev: number, curr: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function formatPct(p: number | null) {
  if (p === null) return '—';
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

    const select = {
      salesManager: true,
      manager: true,
      borderPointName: true,
      containerWagonName: true,
      raw: true,
    };

    const [prevShipments, currShipments] = await Promise.all([
      prisma.externalShipment.findMany({
        where: { AND: [{ category: 'IMPORT' }, buildDateWindowWhere(rangePrev)] },
        select,
      }),
      prisma.externalShipment.findMany({
        where: { AND: [{ category: 'IMPORT' }, buildDateWindowWhere(rangeCurr)] },
        select,
      }),
    ]);

    const mgrSet = new Set<string>();
    for (const s of prevShipments) mgrSet.add(resolveSalesLabel(s));
    for (const s of currShipments) mgrSet.add(resolveSalesLabel(s));
    const managers = Array.from(mgrSet).sort((a, b) =>
      a.localeCompare(b, 'mn', { sensitivity: 'base' }),
    );

    const prevBlock = aggregatePeriod(prevShipments, managers);
    const currBlock = aggregatePeriod(currShipments, managers);

    const teuGrowth = formatPct(growthPct(prevBlock.grandTeu, currBlock.grandTeu));

    return NextResponse.json({
      success: true,
      data: {
        referenceDate: toIsoDate(ref),
        previousYear: py,
        currentYear: cy,
        previousRange: { start: toIsoDate(rangePrev.start), end: toIsoDate(rangePrev.end) },
        currentRange: { start: toIsoDate(rangeCurr.start), end: toIsoDate(rangeCurr.end) },
        managers,
        prev: prevBlock,
        curr: currBlock,
        teuYoYGrowthPct: teuGrowth,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message ?? 'Failed to load import registration table' },
      { status: 500 },
    );
  }
}
