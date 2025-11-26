import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const categoryMap: Record<string, string> = {
  type: 'TYPE',
  ownership: 'OWNERSHIP',
  customer: 'CUSTOMER',
  agent: 'AGENT',
  country: 'COUNTRY',
  port: 'PORT',
  area: 'AREA',
  exchange: 'EXCHANGE',
  incoterm: 'INCOTERM',
  sales: 'SALES',
  manager: 'MANAGER',
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: rawSlug } = await params;
    const slug = (rawSlug || '').toLowerCase();
    const category = categoryMap[slug];
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Invalid category slug: ${rawSlug}` },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const includeRaw = url.searchParams.get('include');
    const includeFields = new Set(
      (includeRaw || '')
        .split(',')
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 0),
    );

    const select: any = { id: true, name: true };
    if (includeFields.has('code')) select.code = true;
    if (includeFields.has('meta')) select.meta = true;

    const data = await prisma.masterOption.findMany({
      where: { category: category as any, ...(includeInactive ? {} : { isActive: true }) },
      select,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, category, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to load lookup data', details: err?.message },
      { status: 500 },
    );
  }
}
