import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const querySchema = z.object({
  category: z
    .string()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  search: z.string().optional(),
  include_inactive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : undefined)),
  incotermId: z.string().optional(),
});

const createSchema = z.object({
  text_en: z.string().min(1),
  text_mn: z.string().min(1),
  text_ru: z.string().min(1),
  category: z.enum(['INCLUDE', 'EXCLUDE', 'REMARK']),
  incotermIds: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  text_en: z.string().min(1).optional(),
  text_mn: z.string().min(1).optional(),
  text_ru: z.string().min(1).optional(),
  category: z.enum(['INCLUDE', 'EXCLUDE', 'REMARK']).optional(),
  incotermIds: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessMasterData')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
      include_inactive: searchParams.get('include_inactive') || undefined,
      incotermId: searchParams.get('incotermId') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { category, search, include_inactive, incotermId } = parsed.data;

    const where: any = {};
    if (category) where.category = category;
    if (!include_inactive) where.isActive = true;
    if (search) {
      where.OR = [
        { text_en: { contains: search, mode: 'insensitive' } },
        { text_mn: { contains: search, mode: 'insensitive' } },
        { text_ru: { contains: search, mode: 'insensitive' } },
      ];
    }
    const data = await prisma.quotationText.findMany({
      where,
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    // Filter by incotermId if provided (client-side filter for JSONB array)
    let filteredData = data;
    if (incotermId) {
      filteredData = data.filter((item) => {
        const ids = item.incotermIds as string[] | null;
        return ids && Array.isArray(ids) && ids.includes(incotermId);
      });
    }

    return NextResponse.json({ success: true, data: filteredData });
  } catch (error) {
    console.error('Quotation texts GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessMasterData')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const created = await prisma.quotationText.create({
      data: {
        text_en: data.text_en,
        text_mn: data.text_mn,
        text_ru: data.text_ru,
        category: data.category,
        incotermIds: data.incotermIds ? (data.incotermIds as any) : null,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, message: 'Created', data: created });
  } catch (error) {
    console.error('Quotation text create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessMasterData')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const { id, ...updateData } = data;

    const updated = await prisma.quotationText.update({
      where: { id },
      data: {
        ...(updateData.text_en !== undefined && { text_en: updateData.text_en }),
        ...(updateData.text_mn !== undefined && { text_mn: updateData.text_mn }),
        ...(updateData.text_ru !== undefined && { text_ru: updateData.text_ru }),
        ...(updateData.category !== undefined && { category: updateData.category }),
        ...(updateData.incotermIds !== undefined && { incotermIds: updateData.incotermIds as any }),
        ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
      },
    });

    return NextResponse.json({ success: true, message: 'Updated', data: updated });
  } catch (error) {
    console.error('Quotation text update error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessMasterData')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await prisma.quotationText.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Quotation text delete error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
