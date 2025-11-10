import { prisma } from '@/lib/db';

const IDENTIFIER_CANDIDATES = [
  'id',
  'ID',
  'number',
  'record_number',
  'recordNumber',
  'tracking_no',
  'trackingNo',
  'reference',
  'reference_no',
  'referenceNo',
  'invoice_number',
  'invoiceNumber',
  'container_number',
  'containerNumber',
  'chingeleg_wagon_dugaar',
  'wagon_dugaar',
];

function resolveExternalId(category: ExternalShipmentCategory, record: CargoRecord): string | null {
  for (const key of IDENTIFIER_CANDIDATES) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const raw = record[key];
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim();
    if (value.length > 0) {
      return value;
    }
  }

  const fallbackParts: string[] = [];
  if (record.customer_name) fallbackParts.push(String(record.customer_name).trim());
  const resolvedDate =
    record.burtgel_ognoo || record.entry_date || record.damj_yavsan_ognoo || record.ub_irsen_ognoo;
  if (resolvedDate) fallbackParts.push(String(resolvedDate).trim());
  if (record.paytype) fallbackParts.push(String(record.paytype).trim());
  if (record.nemeltuilchilgeelist) fallbackParts.push(String(record.nemeltuilchilgeelist).trim());

  if (!fallbackParts.length) {
    return null;
  }

  return `${category}:${fallbackParts.join(':')}`;
}

export type ExternalShipmentCategory = 'IMPORT' | 'TRANSIT' | 'EXPORT';

const DEFAULT_BASE_URL = 'https://burtgel.tuushin.mn/api/crm';

const CATEGORY_ENDPOINT: Record<
  ExternalShipmentCategory,
  { path: string; method: 'GET' | 'POST'; defaultFilterType: number }
> = {
  IMPORT: { path: 'import-cargo', method: 'POST', defaultFilterType: 1 },
  TRANSIT: { path: 'transit-cargo', method: 'POST', defaultFilterType: 2 },
  EXPORT: { path: 'export-cargo', method: 'POST', defaultFilterType: 2 },
};

export type SyncExternalShipmentParams = {
  category: ExternalShipmentCategory;
  filterType?: number;
  filterTypes?: number[];
  beginDate: string;
  endDate: string;
};

type CargoRecord = Record<string, any>;

type CargoListResponse = {
  current_page?: number;
  last_page?: number;
  next_page_url?: string | null;
  data?: CargoRecord[];
};

function getBasicAuthHeader() {
  const username = process.env.TUUSHIN_EXTERNAL_CRM_USERNAME;
  const password = process.env.TUUSHIN_EXTERNAL_CRM_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'Missing TUUSHIN_EXTERNAL_CRM_USERNAME or TUUSHIN_EXTERNAL_CRM_PASSWORD environment variables.',
    );
  }
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

function getBaseUrl() {
  return process.env.TUUSHIN_EXTERNAL_CRM_BASE_URL?.replace(/\/$/, '') ?? DEFAULT_BASE_URL;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[\s,]+/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDateRange(beginDate: string, endDate: string) {
  const start = new Date(`${beginDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date range.');
  }
  return { start, end };
}

async function fetchCargoPage(
  category: ExternalShipmentCategory,
  filterType: number,
  beginDate: string,
  endDate: string,
  page: number,
): Promise<CargoListResponse> {
  const { path, method } = CATEGORY_ENDPOINT[category];
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}/${path}`);
  url.searchParams.set('type', String(filterType));
  url.searchParams.set('beginDate', beginDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('page', String(page));

  const requestInit: RequestInit = {
    method,
    headers: {
      Authorization: getBasicAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };

  if (method === 'POST') {
    requestInit.body = JSON.stringify({
      type: filterType,
      beginDate,
      endDate,
      page,
    });
  }

  const response = await fetch(url.toString(), requestInit);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch cargo list (${response.status}): ${text}`);
  }

  return (await response.json()) as CargoListResponse;
}

async function fetchAllCargo(
  category: ExternalShipmentCategory,
  filterType: number,
  beginDate: string,
  endDate: string,
): Promise<CargoRecord[]> {
  const records: CargoRecord[] = [];
  let page = 1;
  while (true) {
    const payload = await fetchCargoPage(category, filterType, beginDate, endDate, page);
    const pageData = Array.isArray(payload.data) ? payload.data : [];
    records.push(...pageData);

    const current = payload.current_page ?? page;
    const last = payload.last_page ?? (pageData.length === 0 ? current : current + 1);
    if (current >= last || pageData.length === 0 || !payload.next_page_url) {
      break;
    }
    page += 1;
  }
  return records;
}

function mapArrivalDate(category: ExternalShipmentCategory, record: CargoRecord) {
  switch (category) {
    case 'IMPORT':
      return parseDate(record.ub_irsen_ognoo ?? record.burtgel_ognoo);
    case 'TRANSIT':
      return parseDate(record.entry_date ?? record.burtgel_ognoo);
    case 'EXPORT':
      return parseDate(record.damj_yavsan_ognoo ?? record.burtgel_ognoo);
    default:
      return null;
  }
}

function calculateTotals(records: CargoRecord[]) {
  return records.reduce(
    (acc, item) => {
      const total = parseNumber(item.totalamount) ?? 0;
      const profitMnt = parseNumber(item.ashig_tugrik) ?? 0;
      const profitCur = parseNumber(item.ashig_valute) ?? 0;
      acc.totalAmount += total;
      acc.totalProfitMnt += profitMnt;
      acc.totalProfitCur += profitCur;
      return acc;
    },
    { totalAmount: 0, totalProfitMnt: 0, totalProfitCur: 0 },
  );
}

function buildShipmentUpsertInput(
  category: ExternalShipmentCategory,
  filterType: number | null | undefined,
  syncLogId: string,
  record: CargoRecord,
  externalId: string,
) {
  const totalAmount = parseNumber(record.totalamount);
  const profitMnt = parseNumber(record.ashig_tugrik);
  const profitCur = parseNumber(record.ashig_valute);
  const parsedNumber = parseNumber(record.number);
  const shipmentNumber = Number.isFinite(parsedNumber ?? NaN)
    ? Math.trunc(parsedNumber as number)
    : null;
  const normalizedFilterType = Number.isFinite(filterType as number) ? Number(filterType) : null;

  return {
    where: {
      externalId_category: {
        externalId,
        category,
      },
    },
    update: {
      filterType: normalizedFilterType,
      number: shipmentNumber,
      containerNumber: record.container_number ?? record.chingeleg_wagon_dugaar ?? null,
      customerName: record.customer_name ?? null,
      registeredAt: parseDate(record.burtgel_ognoo),
      arrivalAt: mapArrivalDate(category, record),
      transitEntryAt: parseDate(record.entry_date),
      currencyCode: record.hansh_valute ?? null,
      totalAmount,
      profitMnt,
      profitCurrency: profitCur,
      paymentType: record.paytype ?? null,
      salesManager: record.sales_manager ?? null,
      manager: record.manager ?? null,
      note: record.note ?? null,
      extraServices: record.nemeltuilchilgeelist ?? null,
      otherServices: record.othernemeltuilchilgeelist ?? null,
      raw: record,
      syncedAt: new Date(),
      syncLogId,
    },
    create: {
      externalId,
      category,
      filterType: normalizedFilterType,
      number: shipmentNumber,
      containerNumber: record.container_number ?? record.chingeleg_wagon_dugaar ?? null,
      customerName: record.customer_name ?? null,
      registeredAt: parseDate(record.burtgel_ognoo),
      arrivalAt: mapArrivalDate(category, record),
      transitEntryAt: parseDate(record.entry_date),
      currencyCode: record.hansh_valute ?? null,
      totalAmount,
      profitMnt,
      profitCurrency: profitCur,
      paymentType: record.paytype ?? null,
      salesManager: record.sales_manager ?? null,
      manager: record.manager ?? null,
      note: record.note ?? null,
      extraServices: record.nemeltuilchilgeelist ?? null,
      otherServices: record.othernemeltuilchilgeelist ?? null,
      raw: record,
      syncedAt: new Date(),
      syncLogId,
    },
  };
}

function resolveRecordDate(category: ExternalShipmentCategory, record: CargoRecord) {
  return (
    parseDate(record.burtgel_ognoo) ??
    parseDate(record.burtgelOgnoo) ??
    parseDate(record.created_at) ??
    parseDate(record.updated_at) ??
    mapArrivalDate(category, record)
  );
}

export async function syncExternalShipments({
  category,
  filterType,
  filterTypes,
  beginDate,
  endDate,
}: SyncExternalShipmentParams) {
  const filterSet = new Set<number>();
  if (Array.isArray(filterTypes)) {
    for (const value of filterTypes) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        filterSet.add(parsed);
      }
    }
  }

  if (typeof filterType === 'number' && Number.isFinite(filterType)) {
    filterSet.add(filterType);
  }

  if (filterSet.size === 0) {
    filterSet.add(CATEGORY_ENDPOINT[category].defaultFilterType);
  }

  const filtersToUse = Array.from(filterSet).sort((a, b) => a - b);

  // Validate required credentials before we create any log entries so we can fail fast.
  getBasicAuthHeader();

  const { start: rangeStart, end: rangeEnd } = buildDateRange(beginDate, endDate);

  const db = prisma as any;

  const log = await db.externalShipmentSyncLog.create({
    data: {
      category,
      filterType: filtersToUse.length === 1 ? filtersToUse[0] : null,
      fromDate: rangeStart,
      toDate: rangeEnd,
      status: 'SUCCESS',
    },
  });

  try {
    let totalFetched = 0;
    const dedupeMap = new Map<
      string,
      {
        record: CargoRecord;
        timestamp: number;
        filterType: number;
      }
    >();
    let skippedWithoutId = 0;

    for (const currentFilterType of filtersToUse) {
      const records = await fetchAllCargo(category, currentFilterType, beginDate, endDate);
      totalFetched += records.length;

      for (const record of records) {
        const timestamp = resolveRecordDate(category, record);
        if (!timestamp) continue;
        const time = timestamp.getTime();
        if (time < rangeStart.getTime() || time > rangeEnd.getTime()) continue;

        const externalId = resolveExternalId(category, record);
        if (!externalId) {
          skippedWithoutId += 1;
          console.warn('Skipping external shipment without stable identifier', {
            category,
            record,
            filterType: currentFilterType,
          });
          continue;
        }

        const existing = dedupeMap.get(externalId);
        if (!existing || time >= existing.timestamp) {
          dedupeMap.set(externalId, {
            record,
            timestamp: time,
            filterType: currentFilterType,
          });
        }
      }
    }

    const filteredRecords = Array.from(dedupeMap.entries()).map(([externalId, entry]) => ({
      externalId,
      record: entry.record,
      filterType: entry.filterType,
    }));

    const totals = calculateTotals(filteredRecords.map((item) => item.record));

    if (filteredRecords.length > 0) {
      await db.externalShipment.deleteMany({
        where: {
          category,
          OR: [
            {
              registeredAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              arrivalAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              transitEntryAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
          ],
        },
      });
    }

    const chunkSize = 25;
    for (let i = 0; i < filteredRecords.length; i += chunkSize) {
      const batch = filteredRecords.slice(i, i + chunkSize);
      await prisma.$transaction(
        batch.map(({ record, externalId, filterType: recordFilterType }) =>
          db.externalShipment.upsert(
            buildShipmentUpsertInput(category, recordFilterType, log.id, record, externalId),
          ),
        ),
      );
    }

    await db.externalShipmentSyncLog.update({
      where: { id: log.id },
      data: {
        recordCount: filteredRecords.length,
        totalAmount: totals.totalAmount,
        totalProfitMnt: totals.totalProfitMnt,
        totalProfitCur: totals.totalProfitCur,
        finishedAt: new Date(),
        status: 'SUCCESS',
        message: [
          `Filters: ${filtersToUse.join(', ')}`,
          `Fetched: ${totalFetched}`,
          skippedWithoutId > 0 ? `Skipped ${skippedWithoutId} without identifiers` : null,
        ]
          .filter(Boolean)
          .join(' | '),
      },
    });

    return {
      logId: log.id,
      category,
      filterType: filtersToUse.length === 1 ? filtersToUse[0] : null,
      filterTypes: filtersToUse,
      fetchedCount: totalFetched,
      recordCount: filteredRecords.length,
      totals,
      skippedWithoutId,
    };
  } catch (error: any) {
    await db.externalShipmentSyncLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        message: error?.message ?? 'Unknown error',
      },
    });
    throw error;
  }
}
