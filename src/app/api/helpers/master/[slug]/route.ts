import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessMasterData')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

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
    const include = url.searchParams.get('include'); // e.g. 'code'

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
      { success: false, error: 'Failed to load master data', details: err?.message },
      { status: 500 },
    );
  }
}
