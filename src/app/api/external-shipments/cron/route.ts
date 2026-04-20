import { NextResponse } from 'next/server';
import { syncExternalShipments, type ExternalShipmentCategory } from '@/lib/external-shipments';
import { prisma } from '@/lib/db';

const ALL_CATEGORIES: ExternalShipmentCategory[] = ['IMPORT', 'TRANSIT', 'EXPORT'];
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_FILTER_TYPES = [1, 2];
const CRON_SECRET_HEADER = 'x-cron-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorizedCronRequest(request: Request, secret: string, url: URL) {
  const providedHeader = request.headers.get(CRON_SECRET_HEADER);
  const providedQuery = url.searchParams.get('secret');
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  return providedHeader === secret || providedQuery === secret || bearer === secret;
}

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

async function resolveCatchupBeginDate(
  categories: ExternalShipmentCategory[],
  fallbackBeginDate: Date,
  endDate: Date,
) {
  const overlapDays = parsePositiveInt(process.env.EXTERNAL_SHIPMENT_CRON_OVERLAP_DAYS) ?? 1;
  const maxBackfillDays =
    parsePositiveInt(process.env.EXTERNAL_SHIPMENT_CRON_MAX_BACKFILL_DAYS) ?? 30;

  const latestSuccess = await prisma.externalShipmentSyncLog.findFirst({
    where: {
      status: 'SUCCESS',
      category: { in: categories },
      finishedAt: { not: null },
    },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true },
  });

  if (!latestSuccess?.finishedAt) {
    return fallbackBeginDate;
  }

  const fromLastSuccess = subtractUtcDays(new Date(latestSuccess.finishedAt), overlapDays);
  const oldestAllowed = subtractUtcDays(endDate, maxBackfillDays);
  const clamped =
    fromLastSuccess.getTime() < oldestAllowed.getTime() ? oldestAllowed : fromLastSuccess;

  if (clamped.getTime() > endDate.getTime()) {
    return fallbackBeginDate;
  }

  return clamped;
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.EXTERNAL_SHIPMENT_CRON_SECRET;
  // Security-first: require a configured secret for cron endpoint.
  if (!secret) {
    return NextResponse.json(
      { error: 'Server misconfigured: EXTERNAL_SHIPMENT_CRON_SECRET is not set.' },
      { status: 503 },
    );
  }
  if (!isAuthorizedCronRequest(request, secret, url)) {
    return NextResponse.json({ error: 'Unauthorized cron invocation.' }, { status: 401 });
  }

  const envWindow = process.env.EXTERNAL_SHIPMENT_CRON_WINDOW_DAYS;
  const envFilters = process.env.EXTERNAL_SHIPMENT_CRON_FILTER_TYPES;
  const envCategories = process.env.EXTERNAL_SHIPMENT_CRON_CATEGORIES;

  const windowDays =
    parsePositiveInt(url.searchParams.get('windowDays')) ??
    parsePositiveInt(envWindow) ??
    DEFAULT_WINDOW_DAYS;

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
    const endDateParam = parseDateParam(url.searchParams.get('endDate')) ?? new Date();
    const fallbackBeginDate = subtractUtcDays(endDateParam, windowDays);
    const explicitBeginDate = parseDateParam(url.searchParams.get('beginDate'));
    let beginDateParam = explicitBeginDate;

    if (!beginDateParam) {
      beginDateParam = await resolveCatchupBeginDate(categories, fallbackBeginDate, endDateParam);
    }

    if (beginDateParam.getTime() > endDateParam.getTime()) {
      beginDateParam = fallbackBeginDate;
    }

    const beginDate = toISODate(beginDateParam);
    const endDate = toISODate(endDateParam);

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
