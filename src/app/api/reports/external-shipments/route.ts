import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ExternalShipmentCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const CATEGORY_VALUES = Object.values(ExternalShipmentCategory);
const DEFAULT_DAY_RANGE = 30;
const BLANK_VARIANTS = ['', ' ', '  ', '   '];

const querySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  categories: z.string().optional(),
  filterTypes: z.string().optional(),
  search: z.string().optional(),
  salesKey: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

type SalesSourceMeta = {
  salesManagerValues: Set<string>;
  managerValues: Set<string>;
  unassigned: boolean;
};

type SalesAccumulator = {
  name: string;
  sources: SalesSourceMeta;
  shipmentCount: number;
  amountBreakdown: Record<string, number>;
  profitMnt: number;
  profitFxBreakdown: Record<string, number>;
  categoryCounts: Record<ExternalShipmentCategory, number>;
  firstShipmentAt: Date | null;
  lastShipmentAt: Date | null;
};

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

function parseCategories(value?: string | null) {
  if (!value) return CATEGORY_VALUES;
  const entries = value
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
  const valid = entries.filter((entry): entry is ExternalShipmentCategory =>
    CATEGORY_VALUES.includes(entry as ExternalShipmentCategory),
  );
  return valid.length ? valid : CATEGORY_VALUES;
}

function parseFilterTypes(value?: string | null) {
  if (!value) return [] as number[];
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((token) => Number.parseInt(token, 10))
        .filter((num) => Number.isFinite(num)),
    ),
  ) as number[];
}

function normalizeDisplayName(raw?: string | null) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

function encodeSourceKey(meta: SalesSourceMeta) {
  const payload = {
    s: Array.from(meta.salesManagerValues),
    m: Array.from(meta.managerValues),
    u: meta.unassigned ? 1 : 0,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeSourceKey(input: string) {
  try {
    const json = Buffer.from(input, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as { s?: string[]; m?: string[]; u?: number };
    return {
      salesManagerValues: Array.isArray(parsed.s)
        ? parsed.s.filter((item) => typeof item === 'string')
        : [],
      managerValues: Array.isArray(parsed.m)
        ? parsed.m.filter((item) => typeof item === 'string')
        : [],
      unassigned: parsed.u === 1,
    };
  } catch (error) {
    return null;
  }
}

function deriveDisplayName(meta: {
  salesManagerValues: string[];
  managerValues: string[];
  unassigned: boolean;
}) {
  const fromSales = meta.salesManagerValues
    .map((value) => normalizeDisplayName(value))
    .find((value): value is string => Boolean(value));
  if (fromSales) return fromSales;
  const fromManager = meta.managerValues
    .map((value) => normalizeDisplayName(value))
    .find((value): value is string => Boolean(value));
  if (fromManager) return fromManager;
  return meta.unassigned ? 'Unassigned' : 'Unknown';
}

function assignTotals(
  target: Record<string, number>,
  currency: string | null | undefined,
  amount: number | null | undefined,
) {
  if (!Number.isFinite(amount)) return;
  const code = (currency ?? 'MNT').toUpperCase();
  target[code] = (target[code] ?? 0) + (amount ?? 0);
}

function updateDateBounds(entry: SalesAccumulator, date: Date | null) {
  if (!date) return;
  if (!entry.firstShipmentAt || date < entry.firstShipmentAt) {
    entry.firstShipmentAt = date;
  }
  if (!entry.lastShipmentAt || date > entry.lastShipmentAt) {
    entry.lastShipmentAt = date;
  }
}

function formatDateISO(date: Date | null) {
  return date ? date.toISOString() : null;
}

function buildBaseWhere(
  range: { start: Date; end: Date },
  categories: ExternalShipmentCategory[],
  filterTypes: number[],
) {
  const where: Prisma.ExternalShipmentWhereInput = {
    OR: [
      {
        syncedAt: {
          gte: range.start,
          lte: range.end,
        },
      },
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

  if (categories.length && categories.length < CATEGORY_VALUES.length) {
    where.category = { in: categories };
  }

  if (filterTypes.length) {
    where.filterType = { in: filterTypes };
  }

  return where;
}

function buildDetailWhere(
  baseWhere: Prisma.ExternalShipmentWhereInput,
  meta: { salesManagerValues: string[]; managerValues: string[]; unassigned: boolean },
) {
  const conditions: Prisma.ExternalShipmentWhereInput[] = [];

  if (meta.salesManagerValues.length) {
    conditions.push({ salesManager: { in: meta.salesManagerValues } });
  }

  if (meta.managerValues.length) {
    conditions.push({ manager: { in: meta.managerValues } });
  }

  if (meta.unassigned) {
    const salesEmptyConditions: Prisma.ExternalShipmentWhereInput[] = [
      ...BLANK_VARIANTS.map((blank) => ({ salesManager: blank })),
      { salesManager: { equals: null } },
    ];

    const managerEmptyConditions: Prisma.ExternalShipmentWhereInput[] = [
      ...BLANK_VARIANTS.map((blank) => ({ manager: blank })),
      { manager: { equals: null } },
    ];

    conditions.push({
      AND: [
        {
          OR: salesEmptyConditions,
        },
        {
          OR: managerEmptyConditions,
        },
      ],
    });
  }

  if (!conditions.length) {
    return null;
  }

  return {
    AND: [baseWhere, { OR: conditions }],
  } satisfies Prisma.ExternalShipmentWhereInput;
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
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      start,
      end,
      categories: categoriesRaw,
      filterTypes: filterTypesRaw,
      search,
      salesKey,
      page: pageRaw,
      pageSize: pageSizeRaw,
    } = parsed.data;

    const range = normalizeDateRange(start, end);
    const categories = parseCategories(categoriesRaw);
    const filterTypes = parseFilterTypes(filterTypesRaw);
    const baseWhere = buildBaseWhere(range, categories, filterTypes);

    if (salesKey) {
      const decoded = decodeSourceKey(salesKey);
      if (!decoded) {
        return NextResponse.json({ error: 'Invalid sales identifier' }, { status: 400 });
      }

      const detailWhere = buildDetailWhere(baseWhere, decoded);
      if (!detailWhere) {
        return NextResponse.json({
          success: true,
          data: {
            salesKey,
            salesName: deriveDisplayName(decoded),
            items: [],
            pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
          },
        });
      }

      const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);
      const pageSize = Math.min(100, Math.max(5, Number.parseInt(pageSizeRaw ?? '15', 10) || 15));
      const skip = (page - 1) * pageSize;

      const [total, shipments] = await Promise.all([
        prisma.externalShipment.count({ where: detailWhere }),
        prisma.externalShipment.findMany({
          where: detailWhere,
          orderBy: { syncedAt: 'desc' },
          skip,
          take: pageSize,
          select: {
            id: true,
            externalId: true,
            category: true,
            filterType: true,
            customerName: true,
            totalAmount: true,
            currencyCode: true,
            profitMnt: true,
            profitCurrency: true,
            salesManager: true,
            manager: true,
            syncedAt: true,
            registeredAt: true,
            arrivalAt: true,
            transitEntryAt: true,
          },
        }),
      ]);

      const totalPages = total ? Math.ceil(total / pageSize) : 0;

      return NextResponse.json({
        success: true,
        data: {
          salesKey,
          salesName: deriveDisplayName(decoded),
          items: shipments.map((shipment) => ({
            id: shipment.id,
            externalId: shipment.externalId,
            category: shipment.category,
            filterType: shipment.filterType,
            customerName: shipment.customerName,
            totalAmount: shipment.totalAmount,
            currencyCode: shipment.currencyCode,
            profitMnt: shipment.profitMnt,
            profitCurrency: shipment.profitCurrency,
            salesManager: shipment.salesManager,
            manager: shipment.manager,
            syncedAt: shipment.syncedAt?.toISOString() ?? null,
            registeredAt: shipment.registeredAt?.toISOString() ?? null,
            arrivalAt: shipment.arrivalAt?.toISOString() ?? null,
            transitEntryAt: shipment.transitEntryAt?.toISOString() ?? null,
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages,
          },
        },
      });
    }

    const shipments = await prisma.externalShipment.findMany({
      where: baseWhere,
      select: {
        salesManager: true,
        manager: true,
        totalAmount: true,
        currencyCode: true,
        profitMnt: true,
        profitCurrency: true,
        category: true,
        syncedAt: true,
        registeredAt: true,
        arrivalAt: true,
        transitEntryAt: true,
      },
    });

    const searchTerm = search?.trim().toLowerCase();

    const totals = {
      shipmentCount: shipments.length,
      amountBreakdown: {} as Record<string, number>,
      profitMnt: 0,
      profitFxBreakdown: {} as Record<string, number>,
      categoryCounts: {
        IMPORT: 0,
        TRANSIT: 0,
        EXPORT: 0,
      } as Record<ExternalShipmentCategory, number>,
    };

    const salesMap = new Map<string, SalesAccumulator>();

    for (const shipment of shipments) {
      const primaryName = normalizeDisplayName(shipment.salesManager);
      const fallbackName = primaryName ? null : normalizeDisplayName(shipment.manager);
      const displayName = primaryName ?? fallbackName ?? 'Unassigned';

      let entry = salesMap.get(displayName);
      if (!entry) {
        entry = {
          name: displayName,
          sources: {
            salesManagerValues: new Set<string>(),
            managerValues: new Set<string>(),
            unassigned: false,
          },
          shipmentCount: 0,
          amountBreakdown: {},
          profitMnt: 0,
          profitFxBreakdown: {},
          categoryCounts: {
            IMPORT: 0,
            TRANSIT: 0,
            EXPORT: 0,
          },
          firstShipmentAt: null,
          lastShipmentAt: null,
        } satisfies SalesAccumulator;
        salesMap.set(displayName, entry);
      }

      entry.shipmentCount += 1;
      entry.categoryCounts[shipment.category] = (entry.categoryCounts[shipment.category] ?? 0) + 1;

      assignTotals(entry.amountBreakdown, shipment.currencyCode, shipment.totalAmount);
      assignTotals(entry.profitFxBreakdown, shipment.currencyCode, shipment.profitCurrency);

      if (Number.isFinite(shipment.profitMnt)) {
        entry.profitMnt += shipment.profitMnt ?? 0;
      }

      const eventDate =
        shipment.registeredAt ??
        shipment.arrivalAt ??
        shipment.transitEntryAt ??
        shipment.syncedAt ??
        null;
      updateDateBounds(entry, eventDate);

      if (primaryName && typeof shipment.salesManager === 'string') {
        entry.sources.salesManagerValues.add(shipment.salesManager);
      }
      if (!primaryName && fallbackName && typeof shipment.manager === 'string') {
        entry.sources.managerValues.add(shipment.manager);
      }
      if (!primaryName && !fallbackName) {
        entry.sources.unassigned = true;
      }

      assignTotals(totals.amountBreakdown, shipment.currencyCode, shipment.totalAmount);
      assignTotals(totals.profitFxBreakdown, shipment.currencyCode, shipment.profitCurrency);
      if (Number.isFinite(shipment.profitMnt)) {
        totals.profitMnt += shipment.profitMnt ?? 0;
      }
      totals.categoryCounts[shipment.category] =
        (totals.categoryCounts[shipment.category] ?? 0) + 1;
    }

    let sales = Array.from(salesMap.values()).map((entry) => ({
      key: encodeSourceKey(entry.sources),
      name: entry.name,
      shipmentCount: entry.shipmentCount,
      amountBreakdown: entry.amountBreakdown,
      profitMnt: entry.profitMnt,
      profitFxBreakdown: entry.profitFxBreakdown,
      categoryCounts: entry.categoryCounts,
      firstShipmentAt: formatDateISO(entry.firstShipmentAt),
      lastShipmentAt: formatDateISO(entry.lastShipmentAt),
    }));

    if (searchTerm) {
      sales = sales.filter((entry) => entry.name.toLowerCase().includes(searchTerm));
    }

    sales.sort((a, b) => {
      if (b.shipmentCount !== a.shipmentCount) return b.shipmentCount - a.shipmentCount;
      const amountA = Object.values(a.amountBreakdown).reduce((sum, value) => sum + value, 0);
      const amountB = Object.values(b.amountBreakdown).reduce((sum, value) => sum + value, 0);
      return amountB - amountA;
    });

    return NextResponse.json({
      success: true,
      data: {
        range: {
          start: range.start.toISOString().slice(0, 10),
          end: range.end.toISOString().slice(0, 10),
        },
        filters: {
          categories,
          filterTypes,
          search: searchTerm ?? null,
        },
        totals,
        sales,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to load external shipment sales data.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
