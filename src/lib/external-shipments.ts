import { prisma } from '@/lib/db';

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

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: getBasicAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: method === 'POST' ? '{}' : undefined,
  });

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
  filterType: number,
  syncLogId: string,
  record: CargoRecord,
) {
  const totalAmount = parseNumber(record.totalamount);
  const profitMnt = parseNumber(record.ashig_tugrik);
  const profitCur = parseNumber(record.ashig_valute);

  return {
    where: {
      externalId_category: {
        externalId: String(record.id ?? record.number ?? ''),
        category,
      },
    },
    update: {
      filterType,
      number: record.number ?? null,
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
      externalId: String(record.id ?? record.number ?? crypto.randomUUID()),
      category,
      filterType,
      number: record.number ?? null,
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

export async function syncExternalShipments({
  category,
  filterType,
  beginDate,
  endDate,
}: SyncExternalShipmentParams) {
  const effectiveFilterType = filterType ?? CATEGORY_ENDPOINT[category].defaultFilterType;

  // Validate required credentials before we create any log entries so we can fail fast.
  getBasicAuthHeader();

  const fromDate = parseDate(beginDate);
  const toDate = parseDate(endDate);

  const db = prisma as any;

  const log = await db.externalShipmentSyncLog.create({
    data: {
      category,
      filterType: effectiveFilterType,
      fromDate,
      toDate,
      status: 'SUCCESS',
    },
  });

  try {
    const records = await fetchAllCargo(category, effectiveFilterType, beginDate, endDate);
    const totals = calculateTotals(records);

    const chunkSize = 25;
    for (let i = 0; i < records.length; i += chunkSize) {
      const batch = records.slice(i, i + chunkSize);
      await prisma.$transaction(
        batch.map((record) =>
          db.externalShipment.upsert(
            buildShipmentUpsertInput(category, effectiveFilterType, log.id, record),
          ),
        ),
      );
    }

    await db.externalShipmentSyncLog.update({
      where: { id: log.id },
      data: {
        recordCount: records.length,
        totalAmount: totals.totalAmount,
        totalProfitMnt: totals.totalProfitMnt,
        totalProfitCur: totals.totalProfitCur,
        finishedAt: new Date(),
        status: 'SUCCESS',
      },
    });

    return {
      logId: log.id,
      category,
      filterType: effectiveFilterType,
      recordCount: records.length,
      totals,
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
