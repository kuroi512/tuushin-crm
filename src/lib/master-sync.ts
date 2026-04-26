import { prisma } from '@/lib/db';
import type { JsonRecord, JsonValue } from '@/types/common';
import bcrypt from 'bcryptjs';

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

const STAFF_CATEGORIES = new Set(['SALES', 'MANAGER']);

type CategorySyncStats = {
  category: string;
  total: number;
  inserted: number;
  updated: number;
  deactivated: number;
};

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  return email && email.includes('@') ? email : null;
}

const CYRILLIC_EMAIL_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  ө: 'u',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ү: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterateForEmail(value: string) {
  return value
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_EMAIL_MAP[char] ?? char)
    .join('');
}

function legacySlugifyEmailPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function slugifyEmailPart(value: string) {
  return transliterateForEmail(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function shortExternalId(item: UpsertItem) {
  const shortId = legacySlugifyEmailPart(item.externalId).replace(/\./g, '').slice(0, 8);
  return shortId || legacySlugifyEmailPart(item.category.toLowerCase()) || 'user';
}

function buildProvisionEmail(item: UpsertItem) {
  const meta = (item.meta || {}) as JsonRecord;
  const metaEmail = typeof meta.email === 'string' ? normalizeEmail(meta.email) : null;
  if (metaEmail) return metaEmail;

  const firstName = typeof meta.firstName === 'string' ? meta.firstName : '';
  const lastName = typeof meta.lastName === 'string' ? meta.lastName : '';
  const namePart = slugifyEmailPart([firstName, lastName].filter(Boolean).join('.'));
  const fallbackPart = `${item.category.toLowerCase()}.${shortExternalId(item)}`;
  return `${namePart || fallbackPart}@tuushin.local`;
}

function buildLegacyProvisionEmail(item: UpsertItem) {
  const fallbackPart = legacySlugifyEmailPart(`${item.category}.${item.externalId}`);
  return fallbackPart ? `${fallbackPart}@tuushin.local` : null;
}

function dedupeProvisionEmail(email: string, item: UpsertItem, usedEmails: Set<string>) {
  if (!usedEmails.has(email)) {
    usedEmails.add(email);
    return email;
  }

  const [local, domain] = email.split('@');
  const suffix = shortExternalId(item);
  let candidate = `${local}.${suffix}@${domain || 'tuushin.local'}`;
  let counter = 2;
  while (usedEmails.has(candidate)) {
    candidate = `${local}.${suffix}.${counter}@${domain || 'tuushin.local'}`;
    counter += 1;
  }
  usedEmails.add(candidate);
  return candidate;
}

async function provisionUsersFromStaffOptions(items: UpsertItem[]) {
  const staffItems = items.filter((item) => STAFF_CATEGORIES.has(item.category));
  if (!staffItems.length) return 0;

  const desiredByEmail = new Map<
    string,
    { name: string; role: 'SALES' | 'MANAGER'; email: string; legacyEmails: string[] }
  >();
  const usedEmails = new Set<string>();

  for (const item of staffItems) {
    const email = dedupeProvisionEmail(buildProvisionEmail(item), item, usedEmails);
    const existing = desiredByEmail.get(email);
    const role = item.category === 'MANAGER' ? 'MANAGER' : 'SALES';
    const legacyEmail = buildLegacyProvisionEmail(item);
    if (!existing || role === 'MANAGER') {
      desiredByEmail.set(email, {
        email,
        name: item.name,
        role,
        legacyEmails: legacyEmail ? [legacyEmail] : [],
      });
    }
  }

  const desiredUsers = Array.from(desiredByEmail.values());
  if (!desiredUsers.length) return 0;
  const emailsToFind = Array.from(
    new Set(desiredUsers.flatMap((user) => [user.email, ...user.legacyEmails])),
  );

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emailsToFind } },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  const existingByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  let provisioned = 0;

  for (const user of desiredUsers) {
    const existing =
      existingByEmail.get(user.email) ??
      user.legacyEmails.map((email) => existingByEmail.get(email)).find(Boolean);
    if (!existing) {
      await prisma.user.create({
        data: {
          email: user.email,
          name: user.name,
          password: passwordHash,
          role: user.role as any,
          isActive: true,
        },
      });
      provisioned += 1;
      continue;
    }

    const updates: Record<string, unknown> = {};
    if (existing.email.toLowerCase() !== user.email && !existingByEmail.has(user.email)) {
      updates.email = user.email;
    }
    if (!existing.isActive) {
      updates.isActive = true;
      provisioned += 1;
    }
    if (user.name && existing.name !== user.name) updates.name = user.name;
    if (existing.role !== 'ADMIN' && existing.role !== user.role) updates.role = user.role;

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id: existing.id }, data: updates as any });
    }
  }

  return provisioned;
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

    for (const person of normalized) {
      const { id, first, last } = person;
      const fullName = [first, last].filter(Boolean).join(' ').trim() || null;
      const display = fullName || first || last || id;
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

export async function syncMasterOptions(endpoint: string, options: { categories?: string[] } = {}) {
  const { response } = await fetchWithRetry(endpoint, { attempts: 3, timeoutMs: 10000 });
  const json = (await response.json()) as ExternalResponse;
  const selectedCategories = options.categories
    ? new Set(
        options.categories
          .map((category) => category.trim().toUpperCase())
          .filter((category) => category.length > 0),
      )
    : null;
  const mapped = mapExternalToMaster(json).filter(
    (item) => selectedCategories === null || selectedCategories.has(item.category),
  );

  if (mapped.length === 0) {
    return { updated: 0, inserted: 0, deactivated: 0, usersProvisioned: 0, categories: [] };
  }

  // Pre-fetch existing external ids to differentiate inserted vs updated counts.
  // Using a single query is far cheaper than trying to infer from upsert return values
  // (Prisma upsert does not indicate whether it created or updated).
  const existing = await prisma.masterOption.findMany({
    where: { source: 'EXTERNAL', externalId: { in: mapped.map((m) => m.externalId) } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((e) => e.externalId));
  const categoryStats = new Map<string, CategorySyncStats>();

  for (const item of mapped) {
    const current = categoryStats.get(item.category) ?? {
      category: item.category,
      total: 0,
      inserted: 0,
      updated: 0,
      deactivated: 0,
    };
    current.total += 1;
    if (existingSet.has(item.externalId)) {
      current.updated += 1;
    } else {
      current.inserted += 1;
    }
    categoryStats.set(item.category, current);
  }

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
    const current = categoryStats.get(cat);
    if (current) current.deactivated = result.count;
  }

  const insertedCount = mapped.filter((m) => !existingSet.has(m.externalId)).length;
  const updatedCount = mapped.length - insertedCount;
  const usersProvisioned = await provisionUsersFromStaffOptions(mapped);

  return {
    updated: updatedCount,
    inserted: insertedCount,
    deactivated,
    usersProvisioned,
    categories: Array.from(categoryStats.values()).sort((a, b) =>
      a.category.localeCompare(b.category),
    ),
  };
}
