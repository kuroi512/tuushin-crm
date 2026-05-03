import { Prisma } from '@prisma/client';

export function normalizeTransmodeForReport(value: string) {
  const normalized = value.trim();
  if (!normalized) return normalized;
  // Typographic / ASCII quotes (standard row labels 20' / 40')
  if (/^20\s*[''′'’`]/i.test(normalized)) return "20'";
  if (/^40\s*[''′'’`]/i.test(normalized)) return "40'";
  const compact = normalized.replace(/\s+/g, ' ');
  // Common API spellings without a quote: 40ft, 40 HC, 40GP, 20ft, …
  if (
    /^40ft\b/i.test(compact) ||
    /^40\s*[-]?\s*(ft|hc|hq|gp|nor|ot|os|tank|flat|dry|reefer)\b/i.test(compact) ||
    /\b40\s*(ft|foot|feet)\b/i.test(compact)
  ) {
    return "40'";
  }
  if (
    /^20ft\b/i.test(compact) ||
    /^20\s*[-]?\s*(ft|hc|hq|gp|nor|ot|os|tank|flat|dry|reefer)\b/i.test(compact) ||
    /\b20\s*(ft|foot|feet)\b/i.test(compact)
  ) {
    return "20'";
  }
  return normalized;
}

function normalizeTextValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

/**
 * Transportation mode for reports: uses container wagon name from sync only
 * (no angilal / wagon numbers as fallback).
 */
export function resolveReportTransmodeName(shipment: {
  containerWagonName: string | null;
  raw: Prisma.JsonValue | null;
}): string {
  const raw =
    shipment.raw && typeof shipment.raw === 'object' && !Array.isArray(shipment.raw)
      ? (shipment.raw as Record<string, unknown>)
      : null;

  const candidates = [
    shipment.containerWagonName,
    raw?.container_wagon_name,
    raw?.containerWagonName,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeTextValue(candidate);
    if (normalized) return normalizeTransmodeForReport(normalized);
  }

  return 'Unassigned';
}

export function resolveTeuSourceName(shipment: {
  containerWagonName: string | null;
  raw: Prisma.JsonValue | null;
}): string | null {
  const raw =
    shipment.raw && typeof shipment.raw === 'object' && !Array.isArray(shipment.raw)
      ? (shipment.raw as Record<string, unknown>)
      : null;

  const candidates = [
    shipment.containerWagonName,
    raw?.container_wagon_name,
    raw?.containerWagonName,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeTextValue(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function getTeuWeightFromTransmodeString(transmode: string | null) {
  if (!transmode) return 0;
  const normalized = transmode.trim();
  if (/^40\s*[''′'’`]/i.test(normalized)) return 2;
  if (/^20\s*[''′'’`]/i.test(normalized)) return 1;
  const lower = normalized.toLowerCase();
  if (/\bltl\b/.test(lower) || /\blcl\b/.test(lower) || /\bair\b/.test(lower)) return 0.5;
  if (
    /\bftl\b/.test(lower) ||
    /\bwagon\b/.test(lower) ||
    /\bvagon\b/i.test(normalized) ||
    /\btruck\b/.test(lower) ||
    /\bbulk\b/.test(lower)
  )
    return 3;
  return 0;
}

/**
 * TEU must use the same classification as {@link resolveReportTransmodeName} (normalized 20'/40'),
 * not the raw sync string — otherwise values like "40ft" get TEU 0 while counts sit under 40'.
 */
export function getTeuWeightForExternalShipment(shipment: {
  containerWagonName: string | null;
  raw: Prisma.JsonValue | null;
}): number {
  const mode = resolveReportTransmodeName(shipment);
  if (mode !== 'Unassigned') {
    return getTeuWeightFromTransmodeString(mode);
  }
  const raw = resolveTeuSourceName(shipment);
  if (!raw) return 0;
  return getTeuWeightFromTransmodeString(normalizeTransmodeForReport(raw));
}

/** Урдуур / Хойгуур from border point name (урд / хойд). */
export function classifyBorderPointDirection(
  borderPointName: string | null,
): 'urd' | 'hoid' | 'unknown' {
  if (!borderPointName || !borderPointName.trim()) return 'unknown';
  const hasUrd = /урд/i.test(borderPointName);
  const hasHoid = /хойд/i.test(borderPointName);
  if (hasUrd && !hasHoid) return 'urd';
  if (hasHoid && !hasUrd) return 'hoid';
  return 'unknown';
}
