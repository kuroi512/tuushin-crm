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
});

const createSchema = z.object({
  category: z
    .string()
    .min(1)
    .transform((v) => v.toUpperCase()),
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  meta: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  meta: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

function isExternalLocked(option: any) {
  return option.source === 'EXTERNAL';
}

const CATEGORY_LOCKS = new Set(['SALES', 'MANAGER']);

const isCategoryLocked = (category?: string | null) =>
  category ? CATEGORY_LOCKS.has(category.toUpperCase()) : false;

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
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { category, search, include_inactive } = parsed.data;

    const where: any = {};
    if (category) where.category = category;
    if (!include_inactive) where.isActive = true;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const data = await prisma.masterOption.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Master options GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Create internal-only master option
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
    // Defensive: if zod internal symbol error occurs, fall back to minimal manual validation
    let parsedData: any;
    try {
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: parsed.error.format() },
          { status: 400 },
        );
      }
      parsedData = parsed.data;
    } catch (zerr) {
      console.error('Zod createSchema error, using fallback:', zerr);
      if (!body || typeof body !== 'object') {
        return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
      }
      if (!body.category || !body.name) {
        return NextResponse.json(
          { success: false, error: 'category and name are required' },
          { status: 400 },
        );
      }
      parsedData = {
        category: String(body.category).toUpperCase(),
        name: String(body.name),
        code: body.code ?? undefined,
        meta: body.meta && typeof body.meta === 'object' ? body.meta : undefined,
        isActive: body.isActive === undefined ? true : !!body.isActive,
      };
    }
    const data = parsedData;
    if (isCategoryLocked(data.category)) {
      return NextResponse.json(
        {
          success: false,
          error: 'This category is managed externally and cannot be modified manually.',
        },
        { status: 403 },
      );
    }
    const created = await prisma.masterOption.create({
      data: {
        category: data.category as any,
        name: data.name,
        code: data.code ?? undefined,
        meta: data.meta as any,
        isActive: data.isActive ?? true,
        source: 'INTERNAL',
      },
    });
    return NextResponse.json({ success: true, message: 'Created', data: created });
  } catch (error) {
    console.error('Master option create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Update internal master option
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
    let updateData: any;
    try {
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: parsed.error.format() },
          { status: 400 },
        );
      }
      updateData = parsed.data;
    } catch (zerr) {
      console.error('Zod updateSchema error, using fallback:', zerr);
      if (!body.id) {
        return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
      }
      updateData = body;
    }
    const existing = await prisma.masterOption.findUnique({ where: { id: updateData.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (isCategoryLocked(existing.category)) {
      return NextResponse.json(
        { success: false, error: 'This category is managed externally and cannot be modified.' },
        { status: 403 },
      );
    }
    if (isExternalLocked(existing)) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify externally-synced option' },
        { status: 403 },
      );
    }
    const updated = await prisma.masterOption.update({
      where: { id: existing.id },
      data: {
        name: updateData.name ?? existing.name,
        code: updateData.code !== undefined ? updateData.code : existing.code,
        meta: updateData.meta !== undefined ? (updateData.meta as any) : existing.meta,
        isActive: updateData.isActive !== undefined ? !!updateData.isActive : existing.isActive,
      },
    });
    return NextResponse.json({ success: true, message: 'Updated', data: updated });
  } catch (error) {
    console.error('Master option update error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Delete internal master option
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
      return NextResponse.json(
        { success: false, error: 'id query param required' },
        { status: 400 },
      );
    }
    const existing = await prisma.masterOption.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (isCategoryLocked(existing.category)) {
      return NextResponse.json(
        { success: false, error: 'This category is managed externally and cannot be modified.' },
        { status: 403 },
      );
    }
    if (isExternalLocked(existing)) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete externally-synced option' },
        { status: 403 },
      );
    }
    await prisma.masterOption.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Master option delete error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
