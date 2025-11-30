import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const draftItemSchema = z.object({
  text_en: z.string(),
  text_mn: z.string(),
  text_ru: z.string(),
  category: z.enum(['INCLUDE', 'EXCLUDE', 'REMARK']),
});

const draftSchema = z.object({
  incotermId: z.string().min(1),
  include: z.array(draftItemSchema).optional(),
  exclude: z.array(draftItemSchema).optional(),
  remark: z.array(draftItemSchema).optional(),
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
    const incotermId = searchParams.get('incotermId');
    if (!incotermId) {
      return NextResponse.json(
        { success: false, error: 'incotermId is required' },
        { status: 400 },
      );
    }

    const incoterm = await prisma.masterOption.findUnique({
      where: { id: incotermId, category: 'INCOTERM' },
      select: { id: true, name: true, meta: true },
    });

    if (!incoterm) {
      return NextResponse.json({ success: false, error: 'Incoterm not found' }, { status: 404 });
    }

    const draft = (incoterm.meta as any)?.quotationDraft || null;

    return NextResponse.json({ success: true, data: draft });
  } catch (error) {
    console.error('Incoterm draft GET error:', error);
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
    const parsed = draftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { incotermId, include, exclude, remark } = parsed.data;

    const incoterm = await prisma.masterOption.findUnique({
      where: { id: incotermId, category: 'INCOTERM' },
      select: { meta: true },
    });

    if (!incoterm) {
      return NextResponse.json({ success: false, error: 'Incoterm not found' }, { status: 404 });
    }

    const currentMeta = (incoterm.meta as any) || {};
    const updatedMeta = {
      ...currentMeta,
      quotationDraft: {
        include: include || [],
        exclude: exclude || [],
        remark: remark || [],
      },
    };

    const updated = await prisma.masterOption.update({
      where: { id: incotermId },
      data: { meta: updatedMeta as any },
    });

    return NextResponse.json({ success: true, message: 'Draft saved', data: updated });
  } catch (error) {
    console.error('Incoterm draft save error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
