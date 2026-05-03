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

type Direction = 'urd' | 'hoid' | 'unknown';

type ModeAgg = {
  urd: number;
  hoid: number;
  unknown: number;
  teuUrd: number;
  teuHoid: number;
  teuUnknown: number;
};

function buildDateWindowWhere(range: {
  start: Date;
  end: Date;
}): Prisma.ExternalShipmentWhereInput {
  return {
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
      {
        AND: [
          { registeredAt: { equals: null } },
          { arrivalAt: { equals: null } },
          { transitEntryAt: { equals: null } },
          {
            syncedAt: {
              gte: range.start,
              lte: range.end,
            },
          },
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

const PRIMARY_ROW_ORDER = ["20'", "40'", 'FTL', 'LTL', 'LCL', 'Air', 'Truck', 'Vagon'];

function addToMode(map: Map<string, ModeAgg>, mode: string, direction: Direction, teu: number) {
  if (!map.has(mode)) {
    map.set(mode, { urd: 0, hoid: 0, unknown: 0, teuUrd: 0, teuHoid: 0, teuUnknown: 0 });
  }
  const row = map.get(mode)!;
  if (direction === 'urd') {
    row.urd += 1;
    row.teuUrd += teu;
  } else if (direction === 'hoid') {
    row.hoid += 1;
    row.teuHoid += teu;
  } else {
    row.unknown += 1;
    row.teuUnknown += teu;
  }
}

function aggregatePeriod(shipments: Awaited<ReturnType<typeof loadShipments>>) {
  const byMode = new Map<string, ModeAgg>();
  for (const s of shipments) {
    const mode = resolveReportTransmodeName(s);
    const direction = classifyBorderPointDirection(s.borderPointName);
    const teu = getTeuWeightForExternalShipment(s);
    addToMode(byMode, mode, direction, teu);
  }
  return byMode;
}

function loadShipments(range: { start: Date; end: Date }) {
  return prisma.externalShipment.findMany({
    where: {
      AND: [{ category: 'IMPORT' }, buildDateWindowWhere(range)],
    },
    select: {
      borderPointName: true,
      containerWagonName: true,
      raw: true,
    },
  });
}

function modeTotal(m: ModeAgg) {
  return m.urd + m.hoid + m.unknown;
}

function teuTotal(m: ModeAgg) {
  return m.teuUrd + m.teuHoid + m.teuUnknown;
}

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

    const [shipmentsPrev, shipmentsCurr] = await Promise.all([
      loadShipments(rangePrev),
      loadShipments(rangeCurr),
    ]);

    const aggPrev = aggregatePeriod(shipmentsPrev);
    const aggCurr = aggregatePeriod(shipmentsCurr);

    const allModes = new Set([...aggPrev.keys(), ...aggCurr.keys()]);

    const orderedModes: string[] = [];
    const used = new Set<string>();
    for (const label of PRIMARY_ROW_ORDER) {
      const match = [...allModes].find(
        (m) => m === label || m.toLowerCase() === label.toLowerCase(),
      );
      if (match && !used.has(match)) {
        orderedModes.push(match);
        used.add(match);
      }
    }
    for (const m of [...allModes].sort((a, b) => a.localeCompare(b))) {
      if (!used.has(m)) {
        orderedModes.push(m);
        used.add(m);
      }
    }

    const rows = orderedModes.map((mode) => {
      const p = aggPrev.get(mode) ?? {
        urd: 0,
        hoid: 0,
        unknown: 0,
        teuUrd: 0,
        teuHoid: 0,
        teuUnknown: 0,
      };
      const c = aggCurr.get(mode) ?? {
        urd: 0,
        hoid: 0,
        unknown: 0,
        teuUrd: 0,
        teuHoid: 0,
        teuUnknown: 0,
      };
      return {
        mode,
        prev: { urd: p.urd, hoid: p.hoid, total: modeTotal(p), teu: teuTotal(p) },
        curr: { urd: c.urd, hoid: c.hoid, total: modeTotal(c), teu: teuTotal(c) },
        growthPct: formatPct(growthPct(modeTotal(p), modeTotal(c))),
      };
    });

    const sumAgg = (map: Map<string, ModeAgg>) => {
      const sum: ModeAgg = {
        urd: 0,
        hoid: 0,
        unknown: 0,
        teuUrd: 0,
        teuHoid: 0,
        teuUnknown: 0,
      };
      for (const m of map.values()) {
        sum.urd += m.urd;
        sum.hoid += m.hoid;
        sum.unknown += m.unknown;
        sum.teuUrd += m.teuUrd;
        sum.teuHoid += m.teuHoid;
        sum.teuUnknown += m.teuUnknown;
      }
      return sum;
    };

    const pTot = sumAgg(aggPrev);
    const cTot = sumAgg(aggCurr);
    const totalRow = {
      mode: 'Нийт',
      prev: { urd: pTot.urd, hoid: pTot.hoid, total: modeTotal(pTot), teu: teuTotal(pTot) },
      curr: { urd: cTot.urd, hoid: cTot.hoid, total: modeTotal(cTot), teu: teuTotal(cTot) },
      growthPct: formatPct(growthPct(modeTotal(pTot), modeTotal(cTot))),
    };

    const teuOnlyRow = {
      mode: 'Нийт TEU',
      prev: { urd: pTot.teuUrd, hoid: pTot.teuHoid, total: teuTotal(pTot), teu: teuTotal(pTot) },
      curr: { urd: cTot.teuUrd, hoid: cTot.teuHoid, total: teuTotal(cTot), teu: teuTotal(cTot) },
      growthPct: formatPct(growthPct(teuTotal(pTot), teuTotal(cTot))),
    };

    return NextResponse.json({
      success: true,
      data: {
        referenceDate: toIsoDate(ref),
        previousYear: py,
        currentYear: cy,
        previousRange: { start: toIsoDate(rangePrev.start), end: toIsoDate(rangePrev.end) },
        currentRange: { start: toIsoDate(rangeCurr.start), end: toIsoDate(rangeCurr.end) },
        rows,
        totalRow,
        teuOnlyRow,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message ?? 'Failed to load border import comparison' },
      { status: 500 },
    );
  }
}
