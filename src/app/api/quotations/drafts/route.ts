import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const createDraftSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  data: z.unknown(),
});

const resolveOwnerFilter = (user: { id?: string | null; email?: string | null }) => {
  const filters: Array<Record<string, string>> = [];
  if (user.id) filters.push({ createdById: user.id });
  if (user.email) filters.push({ createdByEmail: user.email });
  return filters;
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessQuotations')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const ownerFilters = resolveOwnerFilter(session.user);
    if (!ownerFilters.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const rows = await (prisma as any).appQuotationDraft.findMany({
      where: { OR: ownerFilters },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        data: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Failed to load quotation drafts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load drafts', details: error?.message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageQuotations')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const now = new Date();
    const fallbackName = `Draft ${now.toISOString().slice(0, 16).replace('T', ' ')}`;

    const row = await (prisma as any).appQuotationDraft.create({
      data: {
        name: parsed.data.name || fallbackName,
        data: parsed.data.data,
        createdById: session.user.id || null,
        createdByEmail: session.user.email || null,
        createdByName: session.user.name || null,
      },
      select: {
        id: true,
        name: true,
        data: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: row });
  } catch (error: any) {
    console.error('Failed to create quotation draft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create draft', details: error?.message },
      { status: 500 },
    );
  }
}
