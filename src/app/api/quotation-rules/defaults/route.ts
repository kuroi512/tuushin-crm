import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

type RuleType = 'INCLUDE' | 'EXCLUDE' | 'REMARK';

async function resolveUserId(rawId: string | undefined | null) {
  if (!rawId) return null;
  try {
    const user = await prisma.user.findUnique({ where: { id: rawId }, select: { id: true } });
    return user?.id ?? null;
  } catch (error) {
    console.error('quotation-rule-defaults resolveUserId error', error);
    return null;
  }
}

const querySchema = z.object({
  incoterm: z
    .string()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  transportMode: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : undefined)),
  type: z
    .enum(['INCLUDE', 'EXCLUDE', 'REMARK'] as const)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
});

const upsertSchema = z.object({
  incoterm: z.string().optional().nullable(),
  transportMode: z.string().optional().nullable(),
  type: z.enum(['INCLUDE', 'EXCLUDE', 'REMARK'] as const),
  snippetIds: z.array(z.string().min(1)).default([]),
  order: z.number().int().optional(),
});

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
    incoterm: searchParams.get('incoterm') || undefined,
    transportMode: searchParams.get('transportMode') || undefined,
    type: searchParams.get('type') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid query parameters', details: parsed.error.format() },
      { status: 400 },
    );
  }
  const { incoterm, transportMode } = parsed.data;
  const type = parsed.data.type as RuleType | undefined;

  const where: Prisma.QuotationRuleDefaultWhereInput = {};
  if (incoterm) where.incoterm = incoterm;
  if (transportMode) where.transportMode = transportMode;
  if (type) where.type = type;

  const defaults = await prisma.quotationRuleDefault.findMany({
    where,
    orderBy: [{ incoterm: 'asc' }, { transportMode: 'asc' }, { type: 'asc' }],
  });

  return NextResponse.json({ success: true, data: defaults });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) return unauthorized();
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'manageQuotationRules')) return forbidden();

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { incoterm, transportMode, type, snippetIds, order } = parsed.data;
  const normalized = {
    incoterm: incoterm ? incoterm.toUpperCase() : null,
    transportMode: transportMode ? transportMode.trim() : null,
    type,
  } satisfies { incoterm: string | null; transportMode: string | null; type: RuleType };

  const filter: Prisma.QuotationRuleDefaultWhereInput = {
    type: normalized.type,
    incoterm: normalized.incoterm === null ? { equals: null } : normalized.incoterm,
    transportMode: normalized.transportMode === null ? { equals: null } : normalized.transportMode,
  };

  const existing = await prisma.quotationRuleDefault.findFirst({ where: filter });
  const userId = await resolveUserId(session.user.id);

  const payload = {
    incoterm: normalized.incoterm,
    transportMode: normalized.transportMode,
    type: normalized.type,
    snippetIds,
    order: order ?? 0,
    updatedById: userId ?? undefined,
  };

  try {
    const updated = existing
      ? await prisma.quotationRuleDefault.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.quotationRuleDefault.create({
          data: payload,
        });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('quotation-rule-defaults PUT error', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upsert defaults',
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
  const parsed = querySchema.safeParse({
    incoterm: searchParams.get('incoterm') || undefined,
    transportMode: searchParams.get('transportMode') || undefined,
    type: searchParams.get('type') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid query parameters', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { incoterm, transportMode } = parsed.data;
  const type = parsed.data.type as RuleType | undefined;
  if (!type) {
    return NextResponse.json(
      { success: false, error: 'type query parameter required' },
      { status: 400 },
    );
  }

  try {
    await prisma.quotationRuleDefault.deleteMany({
      where: {
        incoterm: incoterm ?? null,
        transportMode: transportMode ?? null,
        type,
      },
    });

    return NextResponse.json({ success: true, message: 'Cleared' });
  } catch (error: any) {
    console.error('quotation-rule-defaults DELETE error', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete defaults',
        details: error?.message,
      },
      { status: 500 },
    );
  }
}
