import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const categories = [
  'TYPE',
  'OWNERSHIP',
  'CUSTOMER',
  'AGENT',
  'COUNTRY',
  'PORT',
  'AREA',
  'EXCHANGE',
  'SALES',
  'MANAGER',
] as const;

const slugMap: Record<string, string> = {
  TYPE: 'type',
  OWNERSHIP: 'ownership',
  CUSTOMER: 'customer',
  AGENT: 'agent',
  COUNTRY: 'country',
  PORT: 'port',
  AREA: 'area',
  EXCHANGE: 'exchange',
  SALES: 'sales',
  MANAGER: 'manager',
};

export async function GET(_req: NextRequest) {
  try {
    const counts = await prisma.masterOption.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    const byCategory = new Map(counts.map((c) => [c.category, c._count._all]));

    const list = categories.map((c) => ({
      category: c,
      slug: slugMap[c],
      count: byCategory.get(c) ?? 0,
    }));

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to load categories', details: err?.message },
      { status: 500 },
    );
  }
}
