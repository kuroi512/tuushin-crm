import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { auth } from '@/lib/auth';

// Input schemas for create/update normalized quotation
const createSchema = z.object({
  customerId: z.string().min(1),
  cargoType: z
    .enum([
      'LCL',
      'FTL',
      'FCL',
      'AIR',
      'TRUCK',
      'RORO',
      'TANK',
      'TRAIN',
      'OPEN_TOP',
      'BULK',
      'REEFER',
    ])
    .default('TRUCK'),
  originPortId: z.string().optional(),
  destinationPortId: z.string().optional(),
  currencyId: z.string().min(1),
  totalAmount: z.number().nonnegative(),
  incoterm: z.string().optional(),
  exchangeRate: z.number().positive().default(1),
  profitMargin: z.number().optional(),
  cargoDescription: z.string().optional(),
});

const updateSchema = createSchema
  .partial()
  .extend({ status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED']).optional() });

function refNum(year: number, seq: number) {
  return `QT-${year}-${String(seq).padStart(4, '0')}`;
}

async function nextReferenceNumber() {
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;
  const count = await prisma.quotation.count({
    where: { referenceNumber: { startsWith: prefix } },
  });
  return refNum(year, count + 1);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '15')));
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status') || undefined;
  const customerId = url.searchParams.get('customerId') || undefined;

  const where: any = {};
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (search) {
    where.OR = [
      { referenceNumber: { contains: search, mode: 'insensitive' } },
      { customer: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, companyName: true } },
        originPort: { select: { id: true, name: true, code: true } },
        destinationPort: { select: { id: true, name: true, code: true } },
        currency: { select: { id: true, code: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ success: true, pagination: { page, pageSize, total }, data: items });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }
    const session = await auth();
    const userId = session?.user?.id || undefined;
    if (!userId)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const referenceNumber = await nextReferenceNumber();
    const created = await prisma.quotation.create({
      data: {
        referenceNumber,
        customerId: parsed.data.customerId,
        userId,
        cargoType: parsed.data.cargoType as any,
        cargoDescription: parsed.data.cargoDescription,
        originPortId: parsed.data.originPortId,
        destinationPortId: parsed.data.destinationPortId,
        incoterm: parsed.data.incoterm,
        currencyId: parsed.data.currencyId,
        exchangeRate: parsed.data.exchangeRate,
        totalAmount: parsed.data.totalAmount,
        profitMargin: parsed.data.profitMargin,
      },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }
    const session = await auth();
    const updatedBy = session?.user?.id || undefined;
    if (!updatedBy)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // Guard derived fields: do not allow referenceNumber/userId/createdAt overwrite
    const {
      customerId,
      cargoType,
      originPortId,
      destinationPortId,
      currencyId,
      totalAmount,
      incoterm,
      exchangeRate,
      profitMargin,
      cargoDescription,
      status,
    } = parsed.data;

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        ...(customerId ? { customerId } : {}),
        ...(cargoType ? { cargoType: cargoType as any } : {}),
        ...(originPortId ? { originPortId } : {}),
        ...(destinationPortId ? { destinationPortId } : {}),
        ...(currencyId ? { currencyId } : {}),
        ...(typeof totalAmount === 'number' ? { totalAmount } : {}),
        ...(incoterm ? { incoterm } : {}),
        ...(typeof exchangeRate === 'number' ? { exchangeRate } : {}),
        ...(typeof profitMargin === 'number' ? { profitMargin } : {}),
        ...(typeof cargoDescription === 'string' ? { cargoDescription } : {}),
        ...(status ? { status: status as any } : {}),
        // TODO: set updatedBy once Prisma client is regenerated with this field
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
