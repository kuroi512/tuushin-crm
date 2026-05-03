import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ExternalShipmentCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { formatMonthKey, getMonthDateRange, parseMonthInput } from '@/lib/sales-kpi';
import { resolveReportTransmodeName } from '@/lib/external-shipment-transmode';

const CATEGORY_VALUES = Object.values(ExternalShipmentCategory);
const DEFAULT_DAY_RANGE = 30;
const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;

const querySchema = z.object({
  month: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  categories: z.string().optional(),
  filterTypes: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
  invoiceCreateDateFrom: z.string().optional(),
  invoiceCreateDateTo: z.string().optional(),
  ataUbDateFrom: z.string().optional(),
  ataUbDateTo: z.string().optional(),
});

type TransmodeAccumulator = {
  name: string;
  shipmentCount: number;
  amountBreakdown: Record<string, number>;
  profitMnt: number;
  profitFxBreakdown: Record<string, number>;
  categoryCounts: Record<ExternalShipmentCategory, number>;
  firstShipmentAt: Date | null;
  lastShipmentAt: Date | null;
};

type TransmodesTotals = {
  shipmentCount: number;
  amountBreakdown: Record<string, number>;
  profitMnt: number;
  profitFxBreakdown: Record<string, number>;
  categoryCounts: Record<ExternalShipmentCategory, number>;
  totalRevenue: number;
};

type TransmodeEntry = {
  name: string;
  shipmentCount: number;
  amountBreakdown: Record<string, number>;
  revenue: number;
  profitMnt: number;
  profitFxBreakdown: Record<string, number>;
  categoryCounts: Record<ExternalShipmentCategory, number>;
  firstShipmentAt: string | null;
  lastShipmentAt: string | null;
};

type TransmodesResponseData = {
  month: string;
  range: { start: string; end: string };
  filters: {
    categories: ExternalShipmentCategory[];
    filterTypes: number[];
    search: string | null;
  };
  totals: TransmodesTotals;
  transmodes: TransmodeEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type TransmodesResponseBody = {
  success: boolean;
  data: TransmodesResponseData;
  error?: string;
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

function normalizeTextValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function computeMonthRange(
  monthInput?: string,
  startInput?: string,
  endInput?: string,
): {
  monthKey: string;
  monthDate: Date;
  range: { start: Date; end: Date };
} {
  if (monthInput) {
    const { monthDate, month } = parseMonthInput(monthInput);
    const { start, end } = getMonthDateRange(monthDate);
    return { monthKey: month, monthDate, range: { start, end } };
  }

  const range = normalizeDateRange(startInput, endInput);
  const monthKey = formatMonthKey(range.start);
  const monthDate = parseMonthInput(monthKey).monthDate;
  return { monthKey, monthDate, range };
}

function buildBaseWhere(
  range: { start: Date; end: Date },
  categories: ExternalShipmentCategory[],
  filterTypes: number[],
  invoiceCreateDateFrom?: string | null,
  invoiceCreateDateTo?: string | null,
  ataUbDateFrom?: string | null,
  ataUbDateTo?: string | null,
) {
  const parseDate = (value?: string | null, isStart?: boolean) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(isStart ? `${trimmed}T00:00:00.000Z` : `${trimmed}T23:59:59.999Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const baseDateRange: Prisma.ExternalShipmentWhereInput = {
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
          {
            registeredAt: {
              equals: null,
            },
          },
          {
            arrivalAt: {
              equals: null,
            },
          },
          {
            transitEntryAt: {
              equals: null,
            },
          },
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

  const where: Prisma.ExternalShipmentWhereInput = { ...baseDateRange };

  const invoiceFrom = parseDate(invoiceCreateDateFrom, true);
  const invoiceTo = parseDate(invoiceCreateDateTo, false);
  const ataFrom = parseDate(ataUbDateFrom, true);
  const ataTo = parseDate(ataUbDateTo, false);

  const additionalFilters: any[] = [];

  if (invoiceFrom || invoiceTo) {
    const invoiceFilter: any = {
      gte: invoiceFrom || range.start,
      lte: invoiceTo || range.end,
    };
    if (invoiceTo) {
      invoiceTo.setHours(23, 59, 59, 999);
      invoiceFilter.lte = invoiceTo;
    }
    additionalFilters.push({
      registeredAt: invoiceFilter,
    });
  }

  if (ataFrom || ataTo) {
    const ataFilter: any = {
      gte: ataFrom || range.start,
      lte: ataTo || range.end,
    };
    if (ataTo) {
      ataTo.setHours(23, 59, 59, 999);
      ataFilter.lte = ataTo;
    }
    additionalFilters.push({
      arrivalAt: ataFilter,
    });
  }

  if (additionalFilters.length > 0) {
    where.AND = [baseDateRange, ...additionalFilters];
  }

  if (categories.length && categories.length < CATEGORY_VALUES.length) {
    where.category = { in: categories };
  }

  if (filterTypes.length) {
    where.filterType = { in: filterTypes };
  }

  return where;
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

function sumAmountBreakdown(breakdown: Record<string, number>) {
  return Object.values(breakdown).reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0,
  );
}

function updateDateBounds(entry: TransmodeAccumulator, date: Date | null) {
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
      month,
      start,
      end,
      categories: categoriesRaw,
      filterTypes: filterTypesRaw,
      search,
      page: pageRaw,
      pageSize: pageSizeRaw,
      invoiceCreateDateFrom,
      invoiceCreateDateTo,
      ataUbDateFrom,
      ataUbDateTo,
    } = parsed.data;

    let monthInfo;
    try {
      monthInfo = computeMonthRange(month, start, end);
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message ?? 'Invalid month value.' },
        { status: 400 },
      );
    }

    const categories = parseCategories(categoriesRaw);
    const filterTypes = parseFilterTypes(filterTypesRaw);
    const baseWhere = buildBaseWhere(
      monthInfo.range,
      categories,
      filterTypes,
      invoiceCreateDateFrom,
      invoiceCreateDateTo,
      ataUbDateFrom,
      ataUbDateTo,
    );

    const shipments = await prisma.externalShipment.findMany({
      where: baseWhere,
      select: {
        containerWagonName: true,
        containerNumber: true,
        raw: true,
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

    const searchTermRaw = search?.trim() ?? null;
    const searchTermNormalized = searchTermRaw ? searchTermRaw.toLowerCase() : null;

    const totals: TransmodesTotals = {
      shipmentCount: shipments.length,
      amountBreakdown: {},
      profitMnt: 0,
      profitFxBreakdown: {},
      categoryCounts: {
        IMPORT: 0,
        TRANSIT: 0,
        EXPORT: 0,
      },
      totalRevenue: 0,
    };

    const transmodeMap = new Map<string, TransmodeAccumulator>();

    for (const shipment of shipments) {
      const transmodeName = resolveReportTransmodeName(shipment);

      let entry = transmodeMap.get(transmodeName);
      if (!entry) {
        entry = {
          name: transmodeName,
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
        };
        transmodeMap.set(transmodeName, entry);
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

      assignTotals(totals.amountBreakdown, shipment.currencyCode, shipment.totalAmount);
      assignTotals(totals.profitFxBreakdown, shipment.currencyCode, shipment.profitCurrency);
      if (Number.isFinite(shipment.profitMnt)) {
        totals.profitMnt += shipment.profitMnt ?? 0;
      }
      totals.categoryCounts[shipment.category] =
        (totals.categoryCounts[shipment.category] ?? 0) + 1;
    }

    totals.totalRevenue = sumAmountBreakdown(totals.amountBreakdown);

    let transmodes = Array.from(transmodeMap.values()).map((entry) => {
      const revenue = sumAmountBreakdown(entry.amountBreakdown);

      return {
        name: entry.name,
        shipmentCount: entry.shipmentCount,
        amountBreakdown: entry.amountBreakdown,
        revenue,
        profitMnt: entry.profitMnt,
        profitFxBreakdown: entry.profitFxBreakdown,
        categoryCounts: entry.categoryCounts,
        firstShipmentAt: formatDateISO(entry.firstShipmentAt),
        lastShipmentAt: formatDateISO(entry.lastShipmentAt),
      };
    });

    if (searchTermNormalized) {
      transmodes = transmodes.filter((entry) =>
        entry.name.toLowerCase().includes(searchTermNormalized),
      );
    }

    transmodes.sort((a, b) => {
      if (b.shipmentCount !== a.shipmentCount) return b.shipmentCount - a.shipmentCount;
      return b.revenue - a.revenue;
    });

    const parsedPage = Number.parseInt(pageRaw ?? '', 10);
    const requestedPage = Number.isFinite(parsedPage) ? parsedPage : 1;
    const parsedPageSize = Number.parseInt(pageSizeRaw ?? '', 10);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(5, Number.isFinite(parsedPageSize) ? parsedPageSize : DEFAULT_PAGE_SIZE),
    );
    const totalTransmodes = transmodes.length;
    const totalPages = totalTransmodes ? Math.max(1, Math.ceil(totalTransmodes / pageSize)) : 1;
    const normalizedPage = Math.min(Math.max(requestedPage, 1), totalPages);
    const offset = (normalizedPage - 1) * pageSize;
    const paginatedTransmodes = transmodes.slice(offset, offset + pageSize);

    return NextResponse.json({
      success: true,
      data: {
        month: monthInfo.monthKey,
        range: {
          start: monthInfo.range.start.toISOString().slice(0, 10),
          end: monthInfo.range.end.toISOString().slice(0, 10),
        },
        filters: {
          categories,
          filterTypes,
          search: searchTermRaw,
        },
        totals,
        transmodes: paginatedTransmodes,
        pagination: {
          page: normalizedPage,
          pageSize,
          total: totalTransmodes,
          totalPages,
        },
      },
    } as TransmodesResponseBody);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to load external shipment transmode data.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
