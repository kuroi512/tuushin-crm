import { prisma } from '@/lib/db';
import type { JsonRecord, JsonValue } from '@/types/common';

// Shape of the external API response (partial, only needed fields)
interface ExternalResponse {
  types?: Array<{ id: string | number; name: string; type?: string }>;
  ownership?: Array<{ id: string; name: string }>;
  customer?: Array<{ id: string; name: string; groupname?: string }>;
  agent?: Array<{ id: string; name: string }>;
  country?: Array<{ id: string; name: string; code?: string }>; // code has a leading space sometimes
  port?: Array<{ id: string; name: string; uls?: string }>;
  area?: Array<{ id: string | number; name: string; type?: number }>;
  exchange?: Array<{ id: string; name: string; prefix?: string | null; descr?: string | null }>;
  sales?: Array<{ id: string | number; first_name: string; last_name?: string | null }>;
  manager?: Array<{ id: string | number; first_name: string; last_name?: string | null }>;
}

interface UpsertItem {
  externalId: string;
  category: string;
  name: string;
  code?: string | null;
  meta?: JsonRecord | null;
}

function cleanCode(code?: string | null) {
  if (!code) return undefined;
  return code.trim();
}

const buildMeta = (input: Record<string, JsonValue | null | undefined>): JsonRecord | null => {
  const metaEntries = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, value ?? null] as const);

  if (metaEntries.length === 0) {
    return null;
  }

  return metaEntries.reduce<JsonRecord>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

export function mapExternalToMaster(data: ExternalResponse): UpsertItem[] {
  const items: UpsertItem[] = [];

  data.types?.forEach((t) => {
    items.push({
      externalId: String(t.id),
      category: 'TYPE',
      name: t.name,
      code: t.type,
      meta: buildMeta({ rawType: t.type }),
    });
  });

  data.ownership?.forEach((o) => {
    items.push({ externalId: o.id, category: 'OWNERSHIP', name: o.name });
  });

  data.customer?.forEach((c) => {
    items.push({
      externalId: c.id,
      category: 'CUSTOMER',
      name: c.name,
      meta: buildMeta({ group: c.groupname }),
    });
  });

  data.agent?.forEach((a) => {
    items.push({ externalId: a.id, category: 'AGENT', name: a.name });
  });

  data.country?.forEach((c) => {
    items.push({
      externalId: c.id,
      category: 'COUNTRY',
      name: c.name,
      code: cleanCode(c.code),
    });
  });

  data.port?.forEach((p) => {
    items.push({
      externalId: p.id,
      category: 'PORT',
      name: p.name,
      meta: buildMeta({ country: p.uls }),
    });
  });

  data.area?.forEach((a) => {
    items.push({
      externalId: String(a.id),
      category: 'AREA',
      name: a.name,
      meta: buildMeta({ type: a.type }),
    });
  });

  data.exchange?.forEach((exchange) => {
    items.push({
      externalId: exchange.id,
      category: 'EXCHANGE',
      name: exchange.name,
      code: exchange.name,
      meta: buildMeta({ prefix: exchange.prefix, description: exchange.descr }),
    });
  });

  const assignStaffDisplay = (
    staff:
      | Array<{ id: string | number; first_name: string; last_name?: string | null }>
      | undefined,
    category: 'SALES' | 'MANAGER',
  ) => {
    if (!staff?.length) return;

    type NormalizedStaff = {
      id: string;
      first: string;
      last: string;
    };

    const normalized: NormalizedStaff[] = staff.map((person) => ({
      id: String(person.id),
      first: (person.first_name ?? '').trim(),
      last: (person.last_name ?? '').trim(),
    }));

    const firstNameCounts = new Map<string, number>();
    for (const person of normalized) {
      if (!person.first) continue;
      const key = person.first.toLowerCase();
      firstNameCounts.set(key, (firstNameCounts.get(key) ?? 0) + 1);
    }

    for (const person of normalized) {
      const { id, first, last } = person;
      const fallbackName = last || id;
      let display = first || fallbackName;
      if (first) {
        const count = firstNameCounts.get(first.toLowerCase()) ?? 0;
        if (count > 1 && last) {
          display = `${first} ${last}`.trim();
        } else {
          display = first;
        }
      }

      const fullName = [first, last].filter(Boolean).join(' ').trim() || null;
      items.push({
        externalId: id,
        category,
        name: display,
        meta: buildMeta({
          firstName: first || null,
          lastName: last || null,
          fullName,
          displayName: display,
        }),
      });
    }
  };

  assignStaffDisplay(data.sales, 'SALES');
  assignStaffDisplay(data.manager, 'MANAGER');

  return items;
}

interface RetryMeta {
  attempt: number;
  error?: string;
  status?: number;
}

async function fetchWithRetry(
  url: string,
  options: { attempts?: number; timeoutMs?: number } = {},
): Promise<{ response: Response; attempts: RetryMeta[] }> {
  const { attempts = 3, timeoutMs = 12000 } = options;
  const attemptMeta: RetryMeta[] = [];
  let lastError: Error | null = null;

  for (let i = 1; i <= attempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        attemptMeta.push({ attempt: i, status: res.status, error: res.statusText });
        lastError = new Error(`Bad status: ${res.status}`);
      } else {
        attemptMeta.push({ attempt: i, status: res.status });
        return { response: res, attempts: attemptMeta };
      }
    } catch (error) {
      clearTimeout(timeout);
      const err = error instanceof Error ? error : new Error('Unknown error');
      attemptMeta.push({ attempt: i, error: err.name === 'AbortError' ? 'timeout' : err.message });
      lastError = err;
    }

    if (i < attempts) {
      const backoff = 300 * i;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw Object.assign(new Error(`Failed to fetch external options after ${attempts} attempts`), {
    attempts: attemptMeta,
    cause: lastError,
  });
}

export async function syncMasterOptions(endpoint: string) {
  const { response } = await fetchWithRetry(endpoint, { attempts: 3, timeoutMs: 10000 });
  const json = (await response.json()) as ExternalResponse;
  const mapped = mapExternalToMaster(json);

  if (mapped.length === 0) {
    return { updated: 0, inserted: 0, deactivated: 0 };
  }

  // Pre-fetch existing external ids to differentiate inserted vs updated counts.
  // Using a single query is far cheaper than trying to infer from upsert return values
  // (Prisma upsert does not indicate whether it created or updated).
  const existing = await prisma.masterOption.findMany({
    where: { source: 'EXTERNAL', externalId: { in: mapped.map((m) => m.externalId) } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((e) => e.externalId));

  // Upsert all items in chunks to reduce DB round-trips.
  const now = new Date();
  const chunkSize = Math.max(1, Number(process.env.MASTER_SYNC_BATCH_SIZE || '100'));
  for (let i = 0; i < mapped.length; i += chunkSize) {
    const batch = mapped.slice(i, i + chunkSize);
    await prisma.$transaction(
      batch.map((item) =>
        prisma.masterOption.upsert({
          where: { externalId: item.externalId },
          update: {
            name: item.name,
            category: item.category as any,
            code: item.code,
            meta: item.meta ?? undefined,
            isActive: true,
            source: 'EXTERNAL',
            updatedAt: now,
          },
          create: {
            externalId: item.externalId,
            category: item.category as any,
            name: item.name,
            code: item.code,
            meta: item.meta ?? undefined,
            source: 'EXTERNAL',
          },
        }),
      ),
    );
  }

  const categories = Array.from(new Set(mapped.map((m) => m.category)));
  const idsByCategory = new Map<string, string[]>();
  for (const item of mapped) {
    const list = idsByCategory.get(item.category);
    if (list) {
      list.push(item.externalId);
    } else {
      idsByCategory.set(item.category, [item.externalId]);
    }
  }
  let deactivated = 0;
  for (const cat of categories) {
    const ids = idsByCategory.get(cat) ?? [];
    // Set isActive=false for items in this category not present anymore
    const result = await prisma.masterOption.updateMany({
      where: {
        category: cat as any,
        source: 'EXTERNAL',
        externalId: { notIn: ids },
        isActive: true,
      },
      data: { isActive: false, updatedAt: now },
    });
    deactivated += result.count;
  }

  const insertedCount = mapped.filter((m) => !existingSet.has(m.externalId)).length;
  const updatedCount = mapped.length - insertedCount;

  return {
    updated: updatedCount,
    inserted: insertedCount,
    deactivated,
    usersProvisioned: 0,
  };
}
