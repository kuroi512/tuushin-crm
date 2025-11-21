import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { prisma } from '@/lib/db';

const querySchema = z.object({
  incoterm: z
    .string()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  transportMode: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : undefined)),
});

const RULE_TYPES = ['INCLUDE', 'EXCLUDE', 'REMARK'] as const;
type RuleType = (typeof RULE_TYPES)[number];

type DefaultResolution = {
  type: RuleType;
  snippetIds: string[];
  source: 'mapping' | 'isDefault';
  matched: { incoterm: string | null; transportMode: string | null } | null;
};

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
}

async function resolveDefaults(
  type: RuleType,
  incoterm: string | null,
  transportMode: string | null,
) {
  const targetCombos: Array<{ incoterm: string | null; transportMode: string | null }> = [
    { incoterm, transportMode },
    { incoterm, transportMode: null },
    { incoterm: null, transportMode },
    { incoterm: null, transportMode: null },
  ];

  for (const combo of targetCombos) {
    const record = await prisma.quotationRuleDefault.findFirst({
      where: {
        type,
        incoterm: combo.incoterm === null ? { equals: null } : combo.incoterm,
        transportMode: combo.transportMode === null ? { equals: null } : combo.transportMode,
      },
    });
    if (record && Array.isArray(record.snippetIds) && record.snippetIds.length) {
      return {
        type,
        snippetIds: record.snippetIds.filter((id: any): id is string => typeof id === 'string'),
        source: 'mapping' as const,
        matched: combo,
      } satisfies DefaultResolution;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) return unauthorized();

  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'accessQuotations')) return forbidden();

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    incoterm: searchParams.get('incoterm') || undefined,
    transportMode: searchParams.get('transportMode') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid query parameters', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const incoterm = parsed.data.incoterm ?? null;
  const transportMode = parsed.data.transportMode ?? null;

  const snippets = await prisma.quotationRuleSnippet.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ type: 'asc' }, { order: 'asc' }, { label: 'asc' }],
  });

  const byType: Record<RuleType, typeof snippets> = {
    INCLUDE: [],
    EXCLUDE: [],
    REMARK: [],
  };
  for (const snippet of snippets) {
    byType[snippet.type as RuleType]?.push(snippet);
  }

  const defaults: Record<RuleType, DefaultResolution | null> = {
    INCLUDE: null,
    EXCLUDE: null,
    REMARK: null,
  };

  for (const type of RULE_TYPES) {
    defaults[type] = await resolveDefaults(type, incoterm, transportMode);
    if (!defaults[type]) {
      const fallback = byType[type]
        .filter((s: any) => s.isDefault)
        .sort((a: any, b: any) => a.order - b.order || a.label.localeCompare(b.label));
      if (fallback.length) {
        defaults[type] = {
          type,
          snippetIds: fallback.map((s: any) => s.id),
          source: 'isDefault',
          matched: null,
        } satisfies DefaultResolution;
      }
    }
  }

  const responsePayload = {
    incoterm,
    transportMode,
    snippets: byType,
    defaults,
  };

  return NextResponse.json({ success: true, data: responsePayload });
}
