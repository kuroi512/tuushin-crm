import { NextResponse } from 'next/server';
import { syncExternalShipments, type ExternalShipmentCategory } from '@/lib/external-shipments';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

function validateBody(body: any) {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    errors.push('Request body must be a JSON object.');
    return { errors };
  }

  const rawCategory = String(body.category ?? '').toUpperCase();
  const categories: ExternalShipmentCategory[] = [];
  if (rawCategory === 'ALL') {
    categories.push('IMPORT', 'TRANSIT', 'EXPORT');
  } else if (['IMPORT', 'TRANSIT', 'EXPORT'].includes(rawCategory)) {
    categories.push(rawCategory as ExternalShipmentCategory);
  } else {
    errors.push('category must be one of IMPORT, TRANSIT, EXPORT, or ALL.');
  }

  const beginDate = String(body.beginDate ?? '');
  const endDate = String(body.endDate ?? '');

  if (!beginDate || Number.isNaN(new Date(beginDate).getTime())) {
    errors.push('beginDate is required and must be a valid ISO date string (YYYY-MM-DD).');
  }

  if (!endDate || Number.isNaN(new Date(endDate).getTime())) {
    errors.push('endDate is required and must be a valid ISO date string (YYYY-MM-DD).');
  }

  let filterType: number | undefined;
  if (body.filterType !== undefined) {
    const parsed = Number.parseInt(String(body.filterType), 10);
    if (Number.isNaN(parsed)) {
      errors.push('filterType must be a number when provided.');
    } else {
      filterType = parsed;
    }
  }

  let filterTypes: number[] | undefined;
  if (body.filterTypes !== undefined) {
    const raw = Array.isArray(body.filterTypes)
      ? body.filterTypes
      : String(body.filterTypes)
          .split(/[,\s]+/)
          .filter(Boolean);
    const parsed = raw
      .map((value: unknown) => Number.parseInt(String(value), 10))
      .filter((value: number): value is number => Number.isFinite(value));
    if (!parsed.length) {
      errors.push('filterTypes must include at least one valid number when provided.');
    } else {
      filterTypes = Array.from(new Set(parsed));
    }
  }

  if (filterType !== undefined && filterTypes?.includes(filterType) === false) {
    filterTypes = filterTypes ? [...filterTypes, filterType] : [filterType];
  }

  if (filterTypes) {
    filterTypes = Array.from(new Set(filterTypes));
  }

  if (!errors.length && beginDate && endDate) {
    const rangeStart = new Date(`${beginDate}T00:00:00.000Z`);
    const rangeEnd = new Date(`${endDate}T23:59:59.999Z`);
    if (rangeStart.getTime() > rangeEnd.getTime()) {
      errors.push('beginDate must not be after endDate.');
    }
  }

  return {
    errors,
    categories,
    beginDate,
    endDate,
    filterType,
    filterTypes,
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessMasterData')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const { errors, categories, beginDate, endDate, filterType, filterTypes } =
      validateBody(payload);

    if (errors.length > 0 || !categories?.length || !beginDate || !endDate) {
      return NextResponse.json(
        {
          error: 'Invalid request payload.',
          details: errors,
        },
        { status: 400 },
      );
    }

    const runs = [] as Array<Awaited<ReturnType<typeof syncExternalShipments>>>;
    for (const category of categories) {
      const result = await syncExternalShipments({
        category,
        beginDate,
        endDate,
        filterType,
        filterTypes,
      });
      runs.push(result);
    }

    if (runs.length === 1) {
      return NextResponse.json({ data: runs[0] });
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

    return NextResponse.json({ data: { runs, summary } });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to sync external shipments.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
