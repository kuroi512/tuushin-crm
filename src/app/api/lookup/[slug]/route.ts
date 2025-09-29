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
  sales: 'SALES',
  manager: 'MANAGER',
};

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const slug = (params?.slug || '').toLowerCase();
    const category = categoryMap[slug];
    if (!category) {
      return NextResponse.json(
        { success: false, error: `Invalid category slug: ${params?.slug}` },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const include = url.searchParams.get('include'); // e.g., 'code'

    const select: any = { id: true, name: true };
    if (include === 'code') select.code = true;

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
