import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Quotation } from '@/types/quotation';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import {
  computeProfitFromRates,
  isRateEditLocked,
  ratesEqual,
  sanitizeCustomerRates,
  sanitizeRateList,
  sumRateAmounts,
} from '@/lib/quotations/rates';
import { materializeQuotationOffers, normalizeQuotationOffers } from '@/lib/quotations/offers';

function mapDbToQuotation(row: any): Quotation {
  const payload = (row.payload || {}) as any;
  const normalizedOffers = normalizeQuotationOffers(payload.offers);
  const offers = normalizedOffers.length
    ? materializeQuotationOffers(normalizedOffers, row.id)
    : undefined;
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
    language: payload.language, // Language preference for print page
    consignee: payload.consignee,
    shipper: payload.shipper,
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
    closeReason: payload.closeReason,
    offers,
  } as Quotation;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'accessQuotations')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const row = await prisma.appQuotation.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  if (!hasPermission(role, 'viewAllQuotations')) {
    const payload = (row.payload || {}) as any;
    const userEmail = session.user.email;
    const userId = session.user.id;
    const ownsByEmail = userEmail && row.createdBy === userEmail;
    const ownsByAssignment = userId && payload?.salesManagerId === userId;
    if (!ownsByEmail && !ownsByAssignment) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
  }
  return NextResponse.json({ success: true, data: mapDbToQuotation(row) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageQuotations')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.appQuotation.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    if (!hasPermission(role, 'viewAllQuotations')) {
      const payload = (existing.payload || {}) as any;
      const userEmail = session.user.email;
      const userId = session.user.id;
      const ownsByEmail = userEmail && existing.createdBy === userEmail;
      const ownsByAssignment = userId && payload?.salesManagerId === userId;
      if (!ownsByEmail && !ownsByAssignment) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const existingPayload = (existing.payload || {}) as any;
    const currentCarrierRates = sanitizeRateList(existingPayload.carrierRates);
    const currentExtraServices = sanitizeRateList(existingPayload.extraServices);
    const currentCustomer = sanitizeCustomerRates(existingPayload.customerRates);
    const currentOffers = normalizeQuotationOffers(existingPayload.offers);

    const hasCarrierRates = Object.prototype.hasOwnProperty.call(body, 'carrierRates');
    const hasExtraServices = Object.prototype.hasOwnProperty.call(body, 'extraServices');
    const hasCustomerRates = Object.prototype.hasOwnProperty.call(body, 'customerRates');
    const hasOffers = Object.prototype.hasOwnProperty.call(body, 'offers');

    const nextCarrierRates = hasCarrierRates
      ? sanitizeRateList(body.carrierRates)
      : currentCarrierRates;
    const nextExtraServices = hasExtraServices
      ? sanitizeRateList(body.extraServices)
      : currentExtraServices;
    const nextCustomer = hasCustomerRates
      ? sanitizeCustomerRates(body.customerRates)
      : currentCustomer;
    const nextOffers = hasOffers ? normalizeQuotationOffers(body.offers) : currentOffers;

    const carrierTotal = sumRateAmounts(nextCarrierRates);
    const extraTotal = sumRateAmounts(nextExtraServices);
    const estimatedCost = Math.max(1, carrierTotal + extraTotal);
    const profit = computeProfitFromRates(
      nextCustomer.primary,
      nextCarrierRates,
      nextExtraServices,
    );

    const rateLocked = isRateEditLocked(existing.status);
    if (rateLocked) {
      const carrierChanged = !ratesEqual(currentCarrierRates, nextCarrierRates);
      const extraChanged = !ratesEqual(currentExtraServices, nextExtraServices);
      const customerChanged = !ratesEqual(currentCustomer.rates, nextCustomer.rates);
      if (carrierChanged || extraChanged || customerChanged) {
        return NextResponse.json(
          { success: false, error: 'Rates are locked after confirmation' },
          { status: 409 },
        );
      }
    }

    // Basic validation for editable top-level fields; other fields remain in payload
    const str = (schema = z.string().min(1)) =>
      z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

    const editableSchema = z
      .object({
        origin: str(),
        destination: str(),
        cargoType: str(),
        estimatedCost: z.preprocess((v) => {
          if (v === '' || v === null || typeof v === 'undefined') return undefined;
          return typeof v === 'string' ? Number(v) : v;
        }, z.number().nonnegative().optional()),
        status: str(),
        closeReason: str(),
      })
      .passthrough(); // allow any extra keys to be merged into payload

    const parsed = editableSchema.safeParse({ ...body, estimatedCost });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const input = parsed.data as any;
    input.estimatedCost = estimatedCost;
    input.carrierRates = nextCarrierRates;
    input.extraServices = nextExtraServices;
    input.customerRates = nextCustomer.rates;
    input.profit = profit;
    input.offers = nextOffers;
    // Update include/exclude/remark if provided
    if (Object.prototype.hasOwnProperty.call(body, 'include')) {
      input.include = body.include || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'exclude')) {
      input.exclude = body.exclude || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'remark')) {
      input.remark = body.remark || null;
    }
    const requestedStatus = typeof input.status === 'string' ? input.status : existing.status;
    const requiresCloseReason = requestedStatus === 'CLOSED' || requestedStatus === 'CANCELLED';
    const closeReasonClean =
      typeof input.closeReason === 'string' && input.closeReason.trim().length > 0
        ? input.closeReason.trim()
        : undefined;

    if (requiresCloseReason && !closeReasonClean) {
      return NextResponse.json(
        {
          success: false,
          error: 'closeReason is required when status is CLOSED or CANCELLED',
        },
        { status: 400 },
      );
    }

    const normalizedCloseReason = requiresCloseReason ? closeReasonClean : undefined;
    if (typeof normalizedCloseReason === 'string') {
      input.closeReason = normalizedCloseReason;
    } else {
      delete input.closeReason;
    }

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
      carrierRates: _car,
      extraServices: _ext,
      customerRates: _cus,
      profit: _profit,
      ...rest
    } = input;

    // Ensure language is preserved or set (default to existing or EN)
    // existingPayload is already defined above, reuse it
    const language = input.language || existingPayload?.language || 'EN';

    const payload = { ...existingPayload, ...rest, language };
    if (typeof normalizedCloseReason === 'string') {
      payload.closeReason = normalizedCloseReason;
    } else if ('closeReason' in payload) {
      delete payload.closeReason;
    }
    payload.carrierRates = nextCarrierRates;
    payload.extraServices = nextExtraServices;
    payload.customerRates = nextCustomer.rates;
    payload.profit = profit;
    payload.estimatedCost = estimatedCost;
    payload.offers = nextOffers;

    const updated = await prisma.appQuotation.update({
      where: { id },
      data: {
        client: typeof input.client === 'string' ? input.client : existing.client,
        origin: typeof input.origin === 'string' ? input.origin : existing.origin,
        destination:
          typeof input.destination === 'string' ? input.destination : existing.destination,
        cargoType: typeof input.cargoType === 'string' ? input.cargoType : existing.cargoType,
        estimatedCost,
        status: typeof input.status === 'string' ? input.status : existing.status,
        payload,
      },
    });
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
          closeReason: (existing.payload as any)?.closeReason,
        },
        after: {
          client: updated.client,
          origin: updated.origin,
          destination: updated.destination,
          cargoType: updated.cargoType,
          estimatedCost: updated.estimatedCost,
          status: updated.status,
          closeReason: payload.closeReason,
        },
      },
    });
    return NextResponse.json({
      success: true,
      message: 'Quotation updated',
      data: {
        id: updated.id,
        client: updated.client,
        origin: updated.origin,
        destination: updated.destination,
        status: updated.status,
        estimatedCost: updated.estimatedCost,
        closeReason: payload.closeReason,
      },
    });
  } catch (e) {
    console.error('Quotation update failed:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
