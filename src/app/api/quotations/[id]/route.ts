import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Quotation } from '@/types/quotation';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';

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
    // Spread all payload fields to ensure everything is available
    ...payload,
    // Explicitly map new comprehensive form fields to ensure they're available
    consignee: payload.consignee,
    shipper: payload.shipper,
    payer: payload.payer,
    commodity: payload.commodity,
    terminal: payload.terminal,
    paymentType: payload.paymentType,
    division: payload.division,
    condition: payload.condition,
    tmode: payload.tmode,
    incoterm: payload.incoterm,
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
    salesManager: payload.salesManager,
    tariffManager: payload.tariffManager,
    quotationDate: payload.quotationDate,
    validityDate: payload.validityDate,
    dimensions: payload.dimensions,
    carrierRates: payload.carrierRates,
    extraServices: payload.extraServices,
    customerRates: payload.customerRates,
    profit: payload.profit,
  } as Quotation;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.appQuotation.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: mapDbToQuotation(row) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const existing = await prisma.appQuotation.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Basic validation for editable top-level fields; other fields remain in payload
    const str = (schema = z.string().min(1)) =>
      z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

    const editableSchema = z
      .object({
        client: str(),
        origin: str(),
        destination: str(),
        cargoType: str(),
        estimatedCost: z.preprocess((v) => {
          if (v === '' || v === null || typeof v === 'undefined') return undefined;
          return typeof v === 'string' ? Number(v) : v;
        }, z.number().nonnegative().optional()),
        status: str(),
      })
      .passthrough(); // allow any extra keys to be merged into payload

    const parsed = editableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const input = parsed.data as any;
    // Guard against attempting to change immutable fields
    if (
      typeof input.quotationNumber !== 'undefined' &&
      input.quotationNumber !== existing.quotationNumber
    ) {
      return NextResponse.json(
        { success: false, error: 'quotationNumber is immutable' },
        { status: 409 },
      );
    }

    // Merge payload; strip top-level keys we mirror to avoid duplication drift
    const {
      client: _c,
      origin: _o,
      destination: _d,
      cargoType: _ct,
      estimatedCost: _ec,
      status: _s,
      quotationNumber: _qn,
      id: _id,
      createdAt: _ca,
      updatedAt: _ua,
      createdBy: _cb,
      ...rest
    } = input;

    const payload = { ...(existing.payload as any), ...rest };

    const updated = await prisma.appQuotation.update({
      where: { id },
      data: {
        client: typeof input.client === 'string' ? input.client : existing.client,
        origin: typeof input.origin === 'string' ? input.origin : existing.origin,
        destination:
          typeof input.destination === 'string' ? input.destination : existing.destination,
        cargoType: typeof input.cargoType === 'string' ? input.cargoType : existing.cargoType,
        estimatedCost:
          typeof input.estimatedCost === 'number' ? input.estimatedCost : existing.estimatedCost,
        status: typeof input.status === 'string' ? input.status : existing.status,
        payload,
      },
    });
    const session = await auth();
    await auditLog({
      action: 'quotation.update',
      resource: 'app_quotation',
      resourceId: id,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      ip: getIpFromHeaders((req as any).headers),
      userAgent: getUserAgentFromHeaders((req as any).headers),
      metadata: {
        before: {
          client: existing.client,
          origin: existing.origin,
          destination: existing.destination,
          cargoType: existing.cargoType,
          estimatedCost: existing.estimatedCost,
          status: existing.status,
        },
        after: {
          client: updated.client,
          origin: updated.origin,
          destination: updated.destination,
          cargoType: updated.cargoType,
          estimatedCost: updated.estimatedCost,
          status: updated.status,
        },
      },
    });
    return NextResponse.json({ success: true, data: mapDbToQuotation(updated) });
  } catch (e) {
    console.error('Quotation update failed:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
