import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Quotation } from '@/types/quotation';
import { mockQuotations, allocateIdAndNumber } from './store';

// In-memory storage for MVP/dev (replace with Prisma once DATABASE_URL is set)

const quotationCreateLiteSchema = z.object({
  client: z.string().min(1, 'Client is required'),
  cargoType: z.string().min(1, 'Cargo type is required'),
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  weight: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  estimatedCost: z.number().positive('Estimated cost must be positive'),
});

// NOTE: Mock data and sequence allocation moved to ./store to satisfy Next.js route export constraints.

export async function GET(_request: Request) {
  return NextResponse.json({ success: true, data: mockQuotations });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    const now = new Date();
    // Persist extended fields from the incoming body as well
    const extras: Partial<Quotation> = {
      // Parties & commercial
      shipper: body.shipper,
      consignee: body.consignee,
      payer: body.payer,
      paymentType: body.paymentType,
      division: body.division,
      incoterm: body.incoterm,
      terminal: body.terminal,
      condition: body.condition,
      tmode: body.tmode,
      // Routing
      destinationCountry: body.destinationCountry,
      destinationCity: body.destinationCity,
      destinationAddress: body.destinationAddress,
      borderPort: body.borderPort,
      // Dates
      quotationDate: body.quotationDate,
      validityDate: body.validityDate,
      estDepartureDate: body.estDepartureDate,
      actDepartureDate: body.actDepartureDate,
      estArrivalDate: body.estArrivalDate,
      actArrivalDate: body.actArrivalDate,
      // Notes
      include: body.include,
      exclude: body.exclude,
      comment: body.comment,
      remark: body.remark,
      operationNotes: body.operationNotes,
      // Items & rates
      dimensions: body.dimensions,
      carrierRates: body.carrierRates,
      extraServices: body.extraServices,
      customerRates: body.customerRates,
      profit: body.profit,
    };

    const seq = allocateIdAndNumber();
    const newQuotation: Quotation = {
      id: seq.id,
      quotationNumber: seq.quotationNumber,
      client: parsed.data.client,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      cargoType: parsed.data.cargoType,
      goods: body.commodity ?? body.goods,
      salesManager: body.salesManager ?? body.salesManagerId,
      weight: parsed.data.weight,
      volume: parsed.data.volume,
      estimatedCost: parsed.data.estimatedCost,
      createdAt: now.toISOString().slice(0, 10),
      createdBy: 'admin@freight.mn',
      status: 'CREATED',
      ...extras,
    };

    mockQuotations.unshift(newQuotation);

    return NextResponse.json({ success: true, message: 'Quotation created', data: newQuotation });
  } catch (error) {
    console.error('Quotation create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
