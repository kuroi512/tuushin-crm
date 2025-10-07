import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { prisma } from '@/lib/db';

const querySchema = z.object({
  type: z
    .enum(['INCLUDE', 'EXCLUDE', 'REMARK'] as const)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  incoterm: z
    .string()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  transportMode: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : undefined)),
  includeInactive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : undefined)),
  search: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : undefined)),
});

const createSchema = z.object({
  label: z.string().min(1),
  type: z.enum(['INCLUDE', 'EXCLUDE', 'REMARK'] as const),
  incoterm: z.string().optional().nullable(),
  transportMode: z.string().optional().nullable(),
  content: z.string().min(1),
  isDefault: z.boolean().optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().min(1),
});

async function resolveUserId(rawId: string | undefined | null) {
  if (!rawId) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: rawId },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch (error) {
    console.error('resolveUserId error', error);
    return null;
  }
}

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) return unauthorized();

  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'manageQuotationRules')) return forbidden();

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    type: searchParams.get('type') || undefined,
    incoterm: searchParams.get('incoterm') || undefined,
    transportMode: searchParams.get('transportMode') || undefined,
    includeInactive: searchParams.get('includeInactive') || undefined,
    search: searchParams.get('search') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid query parameters', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { type, incoterm, transportMode, includeInactive, search } = parsed.data;

  const where: any = {};
  if (type) where.type = type;
  if (incoterm) where.incoterm = incoterm;
  if (transportMode) where.transportMode = transportMode;
  if (!includeInactive) where.isActive = true;
  if (search) {
    const searchUpper = search.toUpperCase();
    where.OR = [
      { label: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { incoterm: { equals: searchUpper } },
      { transportMode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const snippets = await prisma.quotationRuleSnippet.findMany({
    where,
    orderBy: [
      { type: 'asc' },
      { incoterm: 'asc' },
      { transportMode: 'asc' },
      { order: 'asc' },
      { label: 'asc' },
    ],
  });

  return NextResponse.json({ success: true, data: snippets });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) return unauthorized();
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'manageQuotationRules')) return forbidden();

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const userId = await resolveUserId(session.user.id);

  try {
    const created = await prisma.quotationRuleSnippet.create({
      data: {
        label: data.label,
        type: data.type,
        incoterm: data.incoterm ? data.incoterm.toUpperCase() : null,
        transportMode: data.transportMode ? data.transportMode.trim() : null,
        content: data.content,
        isDefault: data.isDefault ?? false,
        order: data.order ?? 0,
        isActive: data.isActive ?? true,
        createdById: userId ?? undefined,
        updatedById: userId ?? undefined,
      },
    });

    return NextResponse.json({ success: true, message: 'Created', data: created }, { status: 201 });
  } catch (error: any) {
    console.error('quotation-rule-snippets POST error', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create snippet',
        details: error?.message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) return unauthorized();
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'manageQuotationRules')) return forbidden();

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { id, ...patch } = parsed.data;
  const existing = await prisma.quotationRuleSnippet.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const userId = await resolveUserId(session.user.id);

  try {
    const updated = await prisma.quotationRuleSnippet.update({
      where: { id },
      data: {
        label: patch.label ?? existing.label,
        type: (patch.type as any) ?? existing.type,
        incoterm:
          patch.incoterm !== undefined
            ? patch.incoterm
              ? patch.incoterm.toUpperCase()
              : null
            : existing.incoterm,
        transportMode:
          patch.transportMode !== undefined
            ? patch.transportMode
              ? patch.transportMode.trim()
              : null
            : existing.transportMode,
        content: patch.content ?? existing.content,
        isDefault: patch.isDefault ?? existing.isDefault,
        order: patch.order ?? existing.order,
        isActive: patch.isActive ?? existing.isActive,
        updatedById: userId ?? undefined,
      },
    });

    return NextResponse.json({ success: true, message: 'Updated', data: updated });
  } catch (error: any) {
    console.error('quotation-rule-snippets PATCH error', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update snippet',
        details: error?.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) return unauthorized();
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'manageQuotationRules')) return forbidden();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const force = searchParams.get('force') === 'true';
  if (!id) {
    return NextResponse.json({ success: false, error: 'id query param required' }, { status: 400 });
  }

  const existing = await prisma.quotationRuleSnippet.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  try {
    if (force) {
      await prisma.quotationRuleSnippet.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Deleted' });
    }

    const userId = await resolveUserId(session.user.id);
    await prisma.quotationRuleSnippet.update({
      where: { id },
      data: { isActive: false, updatedById: userId ?? undefined },
    });

    return NextResponse.json({ success: true, message: 'Archived' });
  } catch (error: any) {
    console.error('quotation-rule-snippets DELETE error', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete snippet', details: error?.message },
      { status: 500 },
    );
  }
}
