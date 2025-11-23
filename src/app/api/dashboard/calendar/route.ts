import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

type AppQuotation = Awaited<ReturnType<typeof prisma.appQuotation.findMany>>[number];

const querySchema = z.object({
  start: z.string().min(1, 'start is required'),
  end: z.string().min(1, 'end is required'),
  today: z.string().optional(),
});

type CalendarStatus =
  | 'CREATED'
  | 'QUOTATION'
  | 'CONFIRMED'
  | 'ONGOING'
  | 'ARRIVED'
  | 'RELEASED'
  | 'CLOSED'
  | 'CANCELLED';

type CalendarEvent = {
  id: string;
  code: string;
  status: CalendarStatus;
  title?: string;
  description?: string;
};

type CalendarSummary = {
  totalDays: number;
  totalEvents: number;
  range: { start: string; end: string; today?: string };
  statusCounts: Record<CalendarStatus, number>;
};

function parseDate(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithin(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function formatKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

const STATUS_ORDER: Record<CalendarStatus, number> = {
  CREATED: 0,
  QUOTATION: 1,
  CONFIRMED: 2,
  ONGOING: 3,
  ARRIVED: 4,
  RELEASED: 5,
  CLOSED: 6,
  CANCELLED: 7,
};

const STATUS_DATE_RESOLVERS: Record<
  CalendarStatus,
  (quotation: AppQuotation, payload: Record<string, any>) => Date | null
> = {
  CREATED: (quotation) => quotation.createdAt,
  QUOTATION: (_, payload) => parseDate(payload.quotationDate) ?? null,
  CONFIRMED: (quotation, payload) =>
    parseDate(payload.confirmedDate) ?? parseDate(payload.confirmedAt) ?? quotation.updatedAt,
  ONGOING: (_, payload) =>
    parseDate(payload.estDepartureDate) ?? parseDate(payload.actDepartureDate),
  ARRIVED: (_, payload) => parseDate(payload.estArrivalDate) ?? parseDate(payload.actArrivalDate),
  RELEASED: (_, payload) =>
    parseDate(payload.releaseDate) ??
    parseDate(payload.validityDate) ??
    parseDate(payload.actArrivalDate),
  CLOSED: (quotation, payload) =>
    parseDate(payload.validityDate) ?? parseDate(payload.closedDate) ?? quotation.updatedAt,
  CANCELLED: (quotation) => quotation.updatedAt,
};

function normalizeStatus(raw?: string | null): CalendarStatus {
  const upper = (raw ?? '').toUpperCase();
  if (upper in STATUS_ORDER) return upper as CalendarStatus;
  return 'CREATED';
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'accessDashboard')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const startDate = new Date(parsed.data.start);
  const endDate = new Date(parsed.data.end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date range supplied.' }, { status: 400 });
  }

  if (startDate.getTime() > endDate.getTime()) {
    return NextResponse.json(
      { error: '`start` must be before or equal to `end`.' },
      { status: 400 },
    );
  }

  try {
    const where: any = {
      OR: [
        { createdAt: { gte: startDate, lte: endDate } },
        { updatedAt: { gte: startDate, lte: endDate } },
      ],
    };

    // Filter quotations for sales users to only show their own
    if (!hasPermission(role, 'viewAllQuotations')) {
      const scoped: any[] = [];
      if (session.user.email) scoped.push({ createdBy: session.user.email });
      if (session.user.id) {
        scoped.push({ payload: { path: ['salesManagerId'], equals: session.user.id } });
      }
      if (scoped.length > 0) {
        where.AND = [{ OR: where.OR }, { OR: scoped }];
      } else {
        where.createdBy = session.user.email ?? '__unknown__';
      }
    }

    const quotations = await prisma.appQuotation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const eventsByDate = new Map<string, CalendarEvent[]>();
    const statusCounts: Record<CalendarStatus, number> = {
      CREATED: 0,
      QUOTATION: 0,
      CONFIRMED: 0,
      ONGOING: 0,
      ARRIVED: 0,
      RELEASED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };

    for (const quotation of quotations) {
      const payload = (quotation.payload as Record<string, any>) ?? {};
      const status = normalizeStatus(quotation.status);
      const resolvedDate =
        STATUS_DATE_RESOLVERS[status]?.(quotation, payload) ??
        (status === 'CREATED' ? quotation.createdAt : quotation.updatedAt);

      if (!resolvedDate || !isWithin(resolvedDate, startDate, endDate)) {
        continue;
      }

      const title = quotation.client || payload.client || quotation.quotationNumber;
      const origin = payload.origin ?? quotation.origin ?? '';
      const destination = payload.destination ?? quotation.destination ?? '';
      const route = [origin, destination].filter(Boolean).join(' → ');
      const description = route || payload.cargoType || quotation.cargoType;

      const event: CalendarEvent = {
        id: quotation.id,
        code: quotation.quotationNumber,
        status,
        title,
        description,
      };

      const key = formatKey(resolvedDate);
      const bucket = eventsByDate.get(key) ?? [];
      bucket.push(event);
      eventsByDate.set(key, bucket);
      statusCounts[status] += 1;
    }

    const sortedEntries = Array.from(eventsByDate.entries())
      .map(([key, events]) => {
        const sorted = events.sort((a, b) => {
          const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          if (orderDiff !== 0) return orderDiff;
          return a.code.localeCompare(b.code);
        });
        return [key, sorted] as const;
      })
      .sort(([a], [b]) => a.localeCompare(b));

    const data = Object.fromEntries(sortedEntries);
    const totalEvents = sortedEntries.reduce((sum, [, events]) => sum + events.length, 0);
    const summary: CalendarSummary = {
      totalDays: sortedEntries.length,
      totalEvents,
      range: { start: parsed.data.start, end: parsed.data.end, today: parsed.data.today },
      statusCounts,
    };

    return NextResponse.json({ success: true, data, summary });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to load dashboard calendar.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
