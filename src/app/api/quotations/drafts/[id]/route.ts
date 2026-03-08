import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const updateDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    data: z.unknown().optional(),
  })
  .refine((value) => value.name !== undefined || value.data !== undefined, {
    message: 'Either name or data must be provided',
  });

const resolveOwnerFilter = (id: string, user: { id?: string | null; email?: string | null }) => {
  const ownerFilters: Array<Record<string, string>> = [];
  if (user.id) ownerFilters.push({ createdById: user.id });
  if (user.email) ownerFilters.push({ createdByEmail: user.email });

  if (!ownerFilters.length) {
    return null;
  }

  return {
    id,
    OR: ownerFilters,
  };
};

async function findOwnedDraft(id: string, user: { id?: string | null; email?: string | null }) {
  const where = resolveOwnerFilter(id, user);
  if (!where) return null;

  return (prisma as any).appQuotationDraft.findFirst({
    where,
    select: {
      id: true,
      name: true,
      data: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessQuotations')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing draft id' }, { status: 400 });
    }

    const draft = await findOwnedDraft(id, session.user);
    if (!draft) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: draft });
  } catch (error: any) {
    console.error('Failed to load quotation draft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load draft', details: error?.message },
      { status: 500 },
    );
  }
}

export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageQuotations')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing draft id' }, { status: 400 });
    }

    const where = resolveOwnerFilter(id, session.user);
    if (!where) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const existing = await (prisma as any).appQuotationDraft.findFirst({
      where,
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 });
    }

    const body = await _request.json();
    const parsed = updateDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.data !== undefined) data.data = parsed.data.data;

    const updated = await (prisma as any).appQuotationDraft.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        data: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Failed to update quotation draft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update draft', details: error?.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageQuotations')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing draft id' }, { status: 400 });
    }

    const where = resolveOwnerFilter(id, session.user);
    if (!where) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const existing = await (prisma as any).appQuotationDraft.findFirst({
      where,
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 });
    }

    await (prisma as any).appQuotationDraft.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete quotation draft:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete draft', details: error?.message },
      { status: 500 },
    );
  }
}
