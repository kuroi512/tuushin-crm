import type { QuotationOffer } from '@/types/quotation';

export const formatOfferNumber = (index: number): string => String(index + 1);

export const trimOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const parseOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

type OfferDimensionPayload = {
  length: number;
  width: number;
  height: number;
  quantity: number;
  cbm?: number;
};

type OfferRatePayload = {
  name?: string;
  currency?: string;
  amount?: number;
  isPrimary?: boolean;
};

type OfferProfitPayload = {
  amount?: number;
  currency?: string;
};

export const sanitizeOfferDimensions = (input: unknown): OfferDimensionPayload[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const items: OfferDimensionPayload[] = [];
  input.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const dim = entry as Record<string, unknown>;
    const length = parseOptionalNumber(dim.length);
    const width = parseOptionalNumber(dim.width);
    const height = parseOptionalNumber(dim.height);
    const quantity = parseOptionalNumber(dim.quantity);
    const cbm = parseOptionalNumber(dim.cbm);
    if (length === undefined && width === undefined && height === undefined && cbm === undefined) {
      return;
    }
    items.push({
      length: length ?? 0,
      width: width ?? 0,
      height: height ?? 0,
      quantity: quantity ?? 0,
      ...(cbm !== undefined ? { cbm } : {}),
    });
  });
  return items.length ? items : undefined;
};

export const sanitizeOfferRateItems = (input: unknown): OfferRatePayload[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const items: OfferRatePayload[] = [];
  input.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const rate = entry as Record<string, unknown>;
    const name = trimOptionalString(rate.name);
    const currency = trimOptionalString(rate.currency);
    const amount = parseOptionalNumber(rate.amount);
    const payload: OfferRatePayload = {};
    if (name) payload.name = name;
    if (currency) payload.currency = currency;
    if (Object.prototype.hasOwnProperty.call(rate, 'amount')) {
      if (amount !== undefined) payload.amount = amount;
    }
    if (
      Object.prototype.hasOwnProperty.call(rate, 'isPrimary') &&
      typeof rate.isPrimary === 'boolean'
    ) {
      payload.isPrimary = rate.isPrimary;
    }
    if (Object.keys(payload).length) items.push(payload);
  });
  return items.length ? items : undefined;
};

export const sanitizeOfferProfit = (input: unknown): OfferProfitPayload | undefined => {
  if (!input || typeof input !== 'object') return undefined;
  const profit = input as Record<string, unknown>;
  const amount = parseOptionalNumber(profit.amount);
  const currency = trimOptionalString(profit.currency);
  const payload: OfferProfitPayload = {};
  if (amount !== undefined) payload.amount = amount;
  if (currency) payload.currency = currency;
  return Object.keys(payload).length ? payload : undefined;
};

export type SerializedQuotationOffer = {
  id: string;
  quotationId?: string;
  title?: string;
  order: number;
  offerNumber?: string;
  transportMode?: string;
  routeSummary?: string;
  borderPort?: string;
  incoterm?: string;
  shipper?: string;
  terminal?: string;
  shipmentCondition?: string;
  transitTime?: string;
  rate?: number;
  rateCurrency?: string;
  grossWeight?: number;
  dimensionsCbm?: number;
  dimensions?: OfferDimensionPayload[];
  carrierRates?: OfferRatePayload[];
  extraServices?: OfferRatePayload[];
  customerRates?: OfferRatePayload[];
  profit?: OfferProfitPayload;
  notes?: string;
  include?: string;
  exclude?: string;
  remark?: string;
};

export const serializeOfferForPayload = (
  offer: QuotationOffer,
  index: number,
): SerializedQuotationOffer => {
  const id = trimOptionalString(offer.id) ?? `offer-${index + 1}`;
  const order = index;
  const offerNumber =
    trimOptionalString(offer.offerNumber ?? undefined) ?? formatOfferNumber(index);

  return {
    id,
    quotationId: trimOptionalString(offer.quotationId ?? undefined),
    title: trimOptionalString(offer.title ?? undefined),
    order,
    offerNumber,
    transportMode: trimOptionalString(offer.transportMode ?? undefined),
    routeSummary: trimOptionalString(offer.routeSummary ?? undefined),
    borderPort: trimOptionalString(offer.borderPort ?? undefined),
    incoterm: trimOptionalString(offer.incoterm ?? undefined),
    shipper: trimOptionalString(offer.shipper ?? undefined),
    terminal: trimOptionalString(offer.terminal ?? undefined),
    shipmentCondition: trimOptionalString(offer.shipmentCondition ?? undefined),
    transitTime: trimOptionalString(offer.transitTime ?? undefined),
    rate: parseOptionalNumber(offer.rate ?? undefined),
    rateCurrency: trimOptionalString(offer.rateCurrency ?? undefined),
    grossWeight: parseOptionalNumber(offer.grossWeight ?? undefined),
    dimensionsCbm: parseOptionalNumber(offer.dimensionsCbm ?? undefined),
    dimensions: sanitizeOfferDimensions(offer.dimensions ?? undefined),
    carrierRates: sanitizeOfferRateItems(offer.carrierRates ?? undefined),
    extraServices: sanitizeOfferRateItems(offer.extraServices ?? undefined),
    customerRates: sanitizeOfferRateItems(offer.customerRates ?? undefined),
    profit: sanitizeOfferProfit(offer.profit ?? undefined),
    notes: trimOptionalString(offer.notes ?? undefined),
    include: trimOptionalString(offer.include ?? undefined),
    exclude: trimOptionalString(offer.exclude ?? undefined),
    remark: trimOptionalString(offer.remark ?? undefined),
  };
};

export const serializeOffersForPayload = (offers: QuotationOffer[]): SerializedQuotationOffer[] =>
  offers.map((offer, index) => serializeOfferForPayload(offer, index));

export const ensureOfferSequence = <
  T extends { order?: number | null; offerNumber?: string | null },
>(
  offers: T[],
): T[] => {
  let mutated = false;
  const next = offers.map((offer, index) => {
    const desiredOrder = index;
    const desiredNumber = formatOfferNumber(index);
    const rawNumber = typeof offer.offerNumber === 'string' ? offer.offerNumber : '';
    const trimmedNumber = rawNumber.trim();
    const hasNumber = trimmedNumber.length > 0;
    const needsOrderUpdate = offer.order !== desiredOrder;
    const needsNumberUpdate = !hasNumber;
    const needsTrimUpdate = hasNumber && rawNumber !== trimmedNumber;

    if (!needsOrderUpdate && !needsNumberUpdate && !needsTrimUpdate) {
      return offer;
    }

    mutated = true;
    const updated = { ...offer } as T;
    if (needsOrderUpdate) {
      (updated as { order?: number | null }).order = desiredOrder;
    }
    if (needsNumberUpdate) {
      (updated as { offerNumber?: string | null }).offerNumber = desiredNumber;
    } else if (needsTrimUpdate) {
      (updated as { offerNumber?: string | null }).offerNumber = trimmedNumber;
    }

    return updated;
  });
  return mutated ? next : offers;
};
