import { buildSalesMatchKey } from '@/lib/sales-kpi';

export type ExternalShipmentSalesFields = {
  salesManager: string | null;
  manager: string | null;
};

function normalizeDisplayName(raw?: string | null) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

export function resolveExternalShipmentSalesLabel(shipment: ExternalShipmentSalesFields) {
  const primary = normalizeDisplayName(shipment.salesManager);
  if (primary) return primary;
  const fallback = normalizeDisplayName(shipment.manager);
  if (fallback) return fallback;
  return 'Unassigned';
}

export function getExternalShipmentSalesMatchKey(shipment: ExternalShipmentSalesFields) {
  return buildSalesMatchKey(resolveExternalShipmentSalesLabel(shipment));
}

/** `null` = no filter (all sales). Empty set = exclude all shipments. */
export function parseSalesMatchKeysParam(value?: string | null): Set<string> | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return new Set();
  return new Set(
    trimmed
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

export function serializeSalesMatchKeys(keys: Set<string> | null) {
  if (!keys || keys.size === 0) return null;
  return Array.from(keys).join(',');
}

export function filterShipmentsBySalesMatchKeys<T extends ExternalShipmentSalesFields>(
  shipments: T[],
  allowedMatchKeys: Set<string> | null,
): T[] {
  if (!allowedMatchKeys) return shipments;
  if (allowedMatchKeys.size === 0) return [];
  return shipments.filter((shipment) =>
    allowedMatchKeys.has(getExternalShipmentSalesMatchKey(shipment)),
  );
}

export function filterSalesLabelsByMatchKeys(
  labels: string[],
  allowedMatchKeys: Set<string> | null,
) {
  if (!allowedMatchKeys) return labels;
  if (allowedMatchKeys.size === 0) return [];
  return labels.filter((label) => allowedMatchKeys.has(buildSalesMatchKey(label)));
}
