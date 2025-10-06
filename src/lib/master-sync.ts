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
  sales?: Array<{ id: string; first_name: string; last_name?: string | null }>;
  manager?: Array<{ id: string; first_name: string; last_name?: string | null }>;
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

  data.sales?.forEach((salesPerson) => {
    const displayName = [salesPerson.first_name, salesPerson.last_name].filter(Boolean).join(' ');
    items.push({
      externalId: salesPerson.id,
      category: 'SALES',
      name: displayName || salesPerson.id,
      meta: buildMeta({ firstName: salesPerson.first_name, lastName: salesPerson.last_name }),
    });
  });

  data.manager?.forEach((manager) => {
    const displayName = [manager.first_name, manager.last_name].filter(Boolean).join(' ');
    items.push({
      externalId: manager.id,
      category: 'MANAGER',
      name: displayName || manager.id,
      meta: buildMeta({ firstName: manager.first_name, lastName: manager.last_name }),
    });
  });

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

  // Upsert all items; collect externalIds by category for later deactivation pass
  const now = new Date();
  // Throttle concurrency to avoid exhausting the DB connection pool
  const limit = Math.max(1, Number(process.env.MASTER_SYNC_CONCURRENCY || '5'));

  async function runWithConcurrency<T, R>(items: T[], n: number, fn: (it: T) => Promise<R>) {
    const results: R[] = new Array(items.length) as any;
    let index = 0;
    const workers = Array.from({ length: n }).map(async () => {
      while (true) {
        const i = index++;
        if (i >= items.length) break;
        results[i] = await fn(items[i]);
      }
    });
    await Promise.all(workers);
    return results;
  }

  await runWithConcurrency(mapped, limit, (item) =>
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
  );

  const categories = Array.from(new Set(mapped.map((m) => m.category)));
  let deactivated = 0;
  for (const cat of categories) {
    const ids = mapped.filter((m) => m.category === cat).map((m) => m.externalId);
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

  // Provision login users for SALES and MANAGER categories with a default password
  const staff = await prisma.masterOption.findMany({
    where: { category: { in: ['SALES', 'MANAGER'] as any }, isActive: true },
    select: { id: true, name: true, meta: true, category: true },
  });

  // Prepare next incremental email counters per role
  const existingSales = await prisma.user.findMany({
    where: { email: { startsWith: 'sales', endsWith: '@tuushin.com' } },
    select: { email: true },
  });
  const existingManager = await prisma.user.findMany({
    where: { email: { startsWith: 'manager', endsWith: '@tuushin.com' } },
    select: { email: true },
  });
  const maxIndex = (emails: { email: string }[], prefix: string) => {
    let max = 0;
    for (const { email } of emails) {
      const m = email.match(new RegExp(`^${prefix}(\\d+)@tuushin\\.com$`));
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    return max;
  };
  let salesIdx = maxIndex(existingSales, 'sales');
  let managerIdx = maxIndex(existingManager, 'manager');

  const nextEmailForRole = (role: 'SALES' | 'MANAGER') => {
    if (role === 'SALES') {
      salesIdx += 1;
      return `sales${salesIdx}@tuushin.com`;
    }
    managerIdx += 1;
    return `manager${managerIdx}@tuushin.com`;
  };

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'test123';
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(defaultPassword, 10);

  for (const s of staff) {
    const role = s.category === 'MANAGER' ? 'MANAGER' : 'SALES';
    const email = (s.meta as any)?.email || nextEmailForRole(role);
    // upsert user by email
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: s.name,
        role: role as any,
        isActive: true,
      },
      create: {
        email,
        name: s.name,
        role: role as any,
        password: hash,
        isActive: true,
      },
    });
    // reflect email back into masterOption.meta for traceability
    const meta = Object.assign({}, s.meta as any, { email, userId: user.id });
    await prisma.masterOption.update({ where: { id: s.id }, data: { meta } });
  }

  return {
    updated: updatedCount,
    inserted: insertedCount,
    deactivated,
    usersProvisioned: staff.length,
  };
}
