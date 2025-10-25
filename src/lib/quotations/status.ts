const STATUS_ALIAS: Record<string, string> = {
  CREATED: 'CREATED',
  QUOTATION: 'QUOTATION',
  CONFIRMED: 'CONFIRMED',
  ONGOING: 'ONGOING',
  ARRIVED: 'ARRIVED',
  RELEASED: 'RELEASED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
};

export const ACTIVE_STATUSES = new Set([
  'CREATED',
  'QUOTATION',
  'CONFIRMED',
  'ONGOING',
  'ARRIVED',
  'RELEASED',
]);

export const OFFER_STATUSES = new Set(['QUOTATION', 'CONFIRMED', 'ONGOING', 'ARRIVED', 'RELEASED']);

export const APPROVED_STATUSES = new Set(['CONFIRMED', 'RELEASED', 'CLOSED']);

export function normalizeAppQuotationStatus(raw?: string | null): string {
  const key = (raw || '').toUpperCase();
  return STATUS_ALIAS[key] ?? 'CREATED';
}

export function isActiveStatus(raw?: string | null) {
  return ACTIVE_STATUSES.has(normalizeAppQuotationStatus(raw));
}

export function isOfferSentStatus(raw?: string | null) {
  return OFFER_STATUSES.has(normalizeAppQuotationStatus(raw));
}

export function isApprovedStatus(raw?: string | null) {
  return APPROVED_STATUSES.has(normalizeAppQuotationStatus(raw));
}
