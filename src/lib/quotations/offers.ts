import { randomUUID } from 'crypto';
import type { QuotationOffer } from '@/types/quotation';

export type NormalizedQuotationOffer = {
  id: string;
  quotationId?: string;
  title?: string;
  order: number;
  offerNumber?: string;

  // Transport & Route details
  transportMode?: string;
  routeSummary?: string;
  borderPort?: string;

  // Commercial terms
  incoterm?: string;
  shipper?: string;
  terminal?: string;

  // Shipment details
  shipmentCondition?: string;
  transitTime?: string;
  rate?: number;
  rateCurrency?: string;
  grossWeight?: number;
  dimensionsCbm?: number;

  // Extended data
  dimensions?: Array<{
    length: number;
    width: number;
    height: number;
    quantity: number;
    cbm?: number;
  }>;
  carrierRates?: Array<{ name: string; currency: string; amount: number }>;
  extraServices?: Array<{ name: string; currency: string; amount: number }>;
  customerRates?: Array<{ name: string; currency: string; amount: number; isPrimary?: boolean }>;
  profit?: { currency: string; amount: number };

  // Notes
  notes?: string;
  include?: string;
  exclude?: string;
  remark?: string;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export function normalizeQuotationOffers(raw: unknown): NormalizedQuotationOffer[] {
  if (!Array.isArray(raw)) return [];

  const offers: NormalizedQuotationOffer[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === 'string' && item.id.trim().length ? item.id.trim() : randomUUID();
    const orderValue = toOptionalNumber(item.order);

    offers.push({
      id,
      quotationId: toOptionalString(item.quotationId),
      title: toOptionalString(item.title),
      order: typeof orderValue === 'number' ? orderValue : index,
      offerNumber: toOptionalString(item.offerNumber),

      // Transport & Route details
      transportMode: toOptionalString(item.transportMode),
      routeSummary: toOptionalString(item.routeSummary),
      borderPort: toOptionalString(item.borderPort),

      // Commercial terms
      incoterm: toOptionalString(item.incoterm),
      shipper: toOptionalString(item.shipper),
      terminal: toOptionalString(item.terminal),

      // Shipment details
      shipmentCondition: toOptionalString(item.shipmentCondition),
      transitTime: toOptionalString(item.transitTime),
      rate: toOptionalNumber(item.rate),
      rateCurrency: toOptionalString(item.rateCurrency),
      grossWeight: toOptionalNumber(item.grossWeight),
      dimensionsCbm: toOptionalNumber(item.dimensionsCbm),

      // Extended data
      dimensions: Array.isArray(item.dimensions) ? (item.dimensions as any) : undefined,
      carrierRates: Array.isArray(item.carrierRates) ? (item.carrierRates as any) : undefined,
      extraServices: Array.isArray(item.extraServices) ? (item.extraServices as any) : undefined,
      customerRates: Array.isArray(item.customerRates) ? (item.customerRates as any) : undefined,
      profit: item.profit && typeof item.profit === 'object' ? (item.profit as any) : undefined,

      // Notes
      notes: toOptionalString(item.notes),
      include: toOptionalString(item.include),
      exclude: toOptionalString(item.exclude),
      remark: toOptionalString(item.remark),
    });
  });

  return offers;
}

export function materializeQuotationOffers(
  offers: NormalizedQuotationOffer[],
  quotationId: string,
): QuotationOffer[] {
  return offers.map((offer) => ({
    ...offer,
    quotationId,
  }));
}
