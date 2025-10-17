import { NextResponse } from 'next/server';
import { syncExternalShipments, type ExternalShipmentCategory } from '@/lib/external-shipments';

function validateBody(body: any) {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    errors.push('Request body must be a JSON object.');
    return { errors };
  }

  const category = String(body.category ?? '').toUpperCase() as ExternalShipmentCategory;
  if (!['IMPORT', 'TRANSIT', 'EXPORT'].includes(category)) {
    errors.push('category must be one of IMPORT, TRANSIT, or EXPORT.');
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

  return {
    errors,
    category,
    beginDate,
    endDate,
    filterType,
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const { errors, category, beginDate, endDate, filterType } = validateBody(payload);

    if (errors.length > 0 || !category || !beginDate || !endDate) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const result = await syncExternalShipments({
      category,
      beginDate,
      endDate,
      filterType,
    });

    return NextResponse.json({ data: result });
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
