import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Quotation } from '@/types/quotation';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';
import { hasPermission, normalizeRole } from '@/lib/permissions';

const quotationCreateLiteSchema = z.object({
  client: z.string().min(1, 'Client is required'),
  cargoType: z.string().min(1, 'Cargo type is required'),
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  weight: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  estimatedCost: z.number().positive('Estimated cost must be positive'),
});

function mapDbToQuotation(row: any): Quotation {
  const payload = (row.payload || {}) as any;
  return {
    id: row.id,
    quotationNumber: row.quotationNumber,
    client: row.client,
    origin: row.origin,
    destination: row.destination,
    cargoType: row.cargoType,
    weight: payload.weight,
    volume: payload.volume,
    estimatedCost: row.estimatedCost,
    createdAt: new Date(row.createdAt).toISOString(),
    createdBy: row.createdBy ?? 'system',
    status: row.status as any,
    // Extended fields stored in payload
    registrationNo: payload.registrationNo,
    containerOrWagon: payload.containerOrWagon,
    incoterm: payload.incoterm,
    type: payload.type,
    ownership: payload.ownership,
    releaseOrder: payload.releaseOrder,
    shipper: payload.shipper,
    country: payload.country,
    cr: payload.cr,
    crDays: payload.crDays,
    carrier: payload.carrier,
    agent1: payload.agent1,
    agent2: payload.agent2,
    agent3: payload.agent3,
    responsibleSpecialist: payload.responsibleSpecialist,
    loadedDate: payload.loadedDate,
    transitWh: payload.transitWh,
    arrivedAtTransitWhDate: payload.arrivedAtTransitWhDate,
    loadedFromTransitWhDate: payload.loadedFromTransitWhDate,
    arrivedAtBorderDate: payload.arrivedAtBorderDate,
    departedBorderDate: payload.departedBorderDate,
    arrivedInUBDate: payload.arrivedInUBDate,
    unloadingYard: payload.unloadingYard,
    devannedDate: payload.devannedDate,
    emptyReturnedDate: payload.emptyReturnedDate,
    wagonNoEmptyReturn: payload.wagonNoEmptyReturn,
    returnArrivedAtBorderDate: payload.returnArrivedAtBorderDate,
    returnDepartedBorderDate: payload.returnDepartedBorderDate,
    exportedDate: payload.exportedDate,
    transferredToOthersDate: payload.transferredToOthersDate,
    transferNote: payload.transferNote,
    transferredTo: payload.transferredTo,
    salesManager: payload.salesManager ?? payload.salesManagerId,
    goods: payload.commodity ?? payload.goods,
    salesDate: payload.salesDate,
    freightCharge: payload.freightCharge,
    paidDate: payload.paidDate,
    paymentStatus: payload.paymentStatus,
    amountPaid: payload.amountPaid,
    consignee: payload.consignee,
    payer: payload.payer,
    terminal: payload.terminal,
    paymentType: payload.paymentType,
    division: payload.division,
    condition: payload.condition,
    tmode: payload.tmode,
    dimensions: payload.dimensions,
    destinationCountry: payload.destinationCountry,
    destinationCity: payload.destinationCity,
    destinationAddress: payload.destinationAddress,
    borderPort: payload.borderPort,
    salesManagerId: payload.salesManagerId,
    include: payload.include,
    exclude: payload.exclude,
    comment: payload.comment,
    remark: payload.remark,
    quotationDate: payload.quotationDate,
    validityDate: payload.validityDate,
    operationNotes: payload.operationNotes,
    // New comprehensive form fields
    originCountry: payload.originCountry,
    originCity: payload.originCity,
    originAddress: payload.originAddress,
    finalCountry: payload.finalCountry,
    finalCity: payload.finalCity,
    finalAddress: payload.finalAddress,
    via: payload.via,
    included: payload.included,
    excluded: payload.excluded,
    additionalInfo: payload.additionalInfo,
    tariffManager: payload.tariffManager,
    commodity: payload.commodity,
    estDepartureDate: payload.estDepartureDate,
    actDepartureDate: payload.actDepartureDate,
    estArrivalDate: payload.estArrivalDate,
    actArrivalDate: payload.actArrivalDate,
    carrierRates: payload.carrierRates,
    extraServices: payload.extraServices,
    customerRates: payload.customerRates,
    profit: payload.profit,
  };
}

async function generateQuotationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QUO-${year}-`;
  // Count existing with this prefix to generate next sequence
  const count = await prisma.appQuotation.count({
    where: { quotationNumber: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(3, '0');
  const candidate = `${prefix}${seq}`;
  // Uniqueness retry just in case
  const exists = await prisma.appQuotation.findUnique({ where: { quotationNumber: candidate } });
  if (!exists) return candidate;
  const seq2 = String(count + 2).padStart(3, '0');
  return `${prefix}${seq2}`;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '15')));
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status') || undefined;

  const role = normalizeRole(session.user.role);

  if (!hasPermission(role, 'accessQuotations')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const where: any = {};
  if (status) where.status = status;

  const andFilters: any[] = [];
  if (search) {
    andFilters.push({
      OR: [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { client: { contains: search, mode: 'insensitive' } },
        { origin: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (!hasPermission(role, 'viewAllQuotations')) {
    const userEmail = session.user.email;
    const userId = session.user.id;
    andFilters.push({
      OR: [
        ...(userEmail ? [{ createdBy: userEmail }] : []),
        ...(userId
          ? [
              {
                payload: {
                  path: ['salesManagerId'],
                  equals: userId,
                },
              },
            ]
          : []),
      ],
    });
  }

  if (andFilters.length) {
    where.AND = andFilters;
  }

  const [total, rows] = await Promise.all([
    prisma.appQuotation.count({ where }),
    prisma.appQuotation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const data = rows.map(mapDbToQuotation);
  return NextResponse.json({ success: true, pagination: { page, pageSize, total }, data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageQuotations')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const parsed = quotationCreateLiteSchema.safeParse({
      client: body.client,
      cargoType: body.cargoType,
      origin: body.origin,
      destination: body.destination,
      weight: body.weight ? Number(body.weight) : undefined,
      volume: body.volume ? Number(body.volume) : undefined,
      estimatedCost: Number(body.estimatedCost),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }
    const createdBy = session?.user?.email || 'system';
    const userId = session?.user?.id;
    const quotationNumber = await generateQuotationNumber();

    const created = await prisma.appQuotation.create({
      data: {
        quotationNumber,
        client: parsed.data.client,
        origin: parsed.data.origin,
        destination: parsed.data.destination,
        cargoType: parsed.data.cargoType,
        estimatedCost: parsed.data.estimatedCost,
        status: 'CREATED',
        createdBy,
        payload: body,
      },
    });
    await auditLog({
      action: 'quotation.create',
      resource: 'app_quotation',
      resourceId: created.id,
      userId,
      userEmail: createdBy,
      ip: getIpFromHeaders((request as any).headers),
      userAgent: getUserAgentFromHeaders((request as any).headers),
      metadata: {
        quotationNumber: created.quotationNumber,
        client: created.client,
        origin: created.origin,
        destination: created.destination,
        cargoType: created.cargoType,
        estimatedCost: created.estimatedCost,
      },
    });

    // Best-effort: also create a normalized Quotation row for future workflows
    // This will not fail the request if mapping cannot be completed.
    (async () => {
      try {
        // Find or create customer by name
        let customerId: string | undefined;
        const customerName = created.client.trim();
        if (customerName) {
          const existingCustomer = await prisma.customer.findFirst({
            where: { companyName: customerName },
          });
          if (existingCustomer) customerId = existingCustomer.id;
          else if (userId) {
            const newCustomer = await prisma.customer.create({
              data: {
                companyName: customerName,
                customerType: 'COMPANY',
                createdBy: userId,
                updatedBy: userId,
                status: 'ACTIVE',
              },
            });
            customerId = newCustomer.id;
          }
        }

        // Resolve ports by code or name
        const findPort = async (text?: string | null) => {
          const t = (text || '').trim();
          if (!t) return undefined as string | undefined;
          const p = await prisma.port.findFirst({
            where: { OR: [{ code: t }, { name: { equals: t, mode: 'insensitive' } }] },
          });
          return p?.id;
        };
        const originPortId = await findPort(created.origin);
        const destinationPortId = await findPort(created.destination);

        // Resolve currency (default USD)
        const currency = await prisma.currency.findFirst({ where: { code: 'USD' } });
        if (!currency || !customerId || !userId) return; // not enough data to create normalized row safely

        // Generate normalized reference number
        const year = new Date().getFullYear();
        const prefix = `QT-${year}-`;
        const seq =
          (await prisma.quotation.count({ where: { referenceNumber: { startsWith: prefix } } })) +
          1;
        const referenceNumber = `QT-${year}-${String(seq).padStart(4, '0')}`;

        await prisma.quotation.create({
          data: {
            referenceNumber,
            customerId,
            userId,
            cargoType: ([
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
            ].includes(created.cargoType)
              ? (created.cargoType as any)
              : 'TRUCK') as any,
            cargoDescription:
              (created.payload as any)?.goods || (created.payload as any)?.commodity || undefined,
            originPortId,
            destinationPortId,
            incoterm: (created.payload as any)?.incoterm || undefined,
            currencyId: currency.id,
            exchangeRate: 1,
            totalAmount: created.estimatedCost,
            profitMargin: (created.payload as any)?.profit?.amount
              ? Number((created.payload as any).profit.amount)
              : undefined,
          },
        });
      } catch (e) {
        console.warn('Normalized quotation create skipped:', e);
      }
    })();

    const dto = mapDbToQuotation(created);
    return NextResponse.json({ success: true, message: 'Quotation created', data: dto });
  } catch (error) {
    console.error('Quotation create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
