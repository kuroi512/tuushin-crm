import { NextResponse } from 'next/server';
import { syncExternalShipments, type ExternalShipmentCategory } from '@/lib/external-shipments';

const ALL_CATEGORIES: ExternalShipmentCategory[] = ['IMPORT', 'TRANSIT', 'EXPORT'];
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_FILTER_TYPES = [1, 2];
const CRON_SECRET_HEADER = 'x-cron-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePositiveInt(value?: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDateParam(value?: string | null) {
  if (!value) return null;
  const normalized = `${value.trim()}T00:00:00.000Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function subtractUtcDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function parseFilterTypes(value?: string | null) {
  if (!value) return null;
  const parsed = value
    .split(/[\s,]+/)
    .map((token) => Number.parseInt(token, 10))
    .filter((num) => Number.isFinite(num));
  if (!parsed.length) return null;
  return Array.from(new Set(parsed));
}

function parseCategoryList(value?: string | null) {
  if (!value) return null;
  const parsed = value
    .split(/[\s,]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(
      (token): token is ExternalShipmentCategory =>
        token === 'IMPORT' || token === 'TRANSIT' || token === 'EXPORT',
    );
  return parsed.length ? Array.from(new Set(parsed)) : null;
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.EXTERNAL_SHIPMENT_CRON_SECRET;
  if (secret) {
    const providedHeader = request.headers.get(CRON_SECRET_HEADER);
    const providedQuery = url.searchParams.get('secret');
    if (providedHeader !== secret && providedQuery !== secret) {
      return NextResponse.json({ error: 'Unauthorized cron invocation.' }, { status: 401 });
    }
  }

  const envWindow = process.env.EXTERNAL_SHIPMENT_CRON_WINDOW_DAYS;
  const envFilters = process.env.EXTERNAL_SHIPMENT_CRON_FILTER_TYPES;
  const envCategories = process.env.EXTERNAL_SHIPMENT_CRON_CATEGORIES;

  const windowDays =
    parsePositiveInt(url.searchParams.get('windowDays')) ??
    parsePositiveInt(envWindow) ??
    DEFAULT_WINDOW_DAYS;

  const endDateParam = parseDateParam(url.searchParams.get('endDate')) ?? new Date();
  let beginDateParam =
    parseDateParam(url.searchParams.get('beginDate')) ?? subtractUtcDays(endDateParam, windowDays);
  if (beginDateParam.getTime() > endDateParam.getTime()) {
    beginDateParam = subtractUtcDays(endDateParam, windowDays);
  }

  const beginDate = toISODate(beginDateParam);
  const endDate = toISODate(endDateParam);

  const filters =
    parseFilterTypes(url.searchParams.get('filters')) ??
    parseFilterTypes(url.searchParams.get('filterTypes')) ??
    parseFilterTypes(envFilters) ??
    DEFAULT_FILTER_TYPES;

  const categories =
    parseCategoryList(url.searchParams.get('categories')) ??
    parseCategoryList(envCategories) ??
    ALL_CATEGORIES;

  try {
    const runs = [] as Array<Awaited<ReturnType<typeof syncExternalShipments>>>;
    for (const category of categories) {
      const run = await syncExternalShipments({
        category,
        beginDate,
        endDate,
        filterTypes: filters,
      });
      runs.push(run);
    }

    const summary = runs.reduce(
      (acc, run) => {
        acc.recordCount += run.recordCount ?? 0;
        acc.fetchedCount += run.fetchedCount ?? 0;
        acc.totalAmount += run.totals?.totalAmount ?? 0;
        acc.totalProfitMnt += run.totals?.totalProfitMnt ?? 0;
        acc.totalProfitCur += run.totals?.totalProfitCur ?? 0;
        acc.skippedWithoutId += run.skippedWithoutId ?? 0;
        return acc;
      },
      {
        recordCount: 0,
        fetchedCount: 0,
        totalAmount: 0,
        totalProfitMnt: 0,
        totalProfitCur: 0,
        skippedWithoutId: 0,
      },
    );

    return NextResponse.json({
      success: true,
      window: {
        beginDate,
        endDate,
        windowDays,
      },
      filters,
      categories,
      runs,
      summary,
    });
  } catch (error: any) {
    console.error('External shipment cron failed', error);
    return NextResponse.json(
      {
        error: 'Failed to run external shipment cron.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
