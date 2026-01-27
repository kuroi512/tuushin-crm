import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

type AppQuotation = Awaited<ReturnType<typeof prisma.appQuotation.findMany>>[number];

type SalesTaskStatus = 'MEET' | 'CONTACT_BY_PHONE' | 'MEETING_DATE' | 'GIVE_INFO' | 'CONTRACT';

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
  | 'CANCELLED'
  | 'SALES_CREATED'
  | 'SALES_MEET'
  | 'SALES_CONTACT'
  | 'SALES_MEETING'
  | 'SALES_INFO'
  | 'SALES_CONTRACT';

type CalendarEvent = {
  id: string;
  code: string;
  status: CalendarStatus;
  type?: 'quotation' | 'salesTask';
  title?: string;
  href?: string;
  time?: string;
  description?: string;
};

type CalendarSummary = {
  totalDays: number;
  totalEvents: number;
  range: { start: string; end: string; today?: string };
  statusCounts: Record<CalendarStatus, number>;
};

function parseDate(input?: string | Date | null) {
  if (!input) return null;
  // If already a Date instance, validate and return
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input !== 'string') return null;
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
  SALES_CREATED: 8,
  SALES_MEET: 9,
  SALES_CONTACT: 10,
  SALES_MEETING: 11,
  SALES_INFO: 12,
  SALES_CONTRACT: 13,
};

const SALES_STATUS_TO_CALENDAR: Record<SalesTaskStatus, CalendarStatus> = {
  MEET: 'SALES_MEET',
  CONTACT_BY_PHONE: 'SALES_CONTACT',
  MEETING_DATE: 'SALES_MEETING',
  GIVE_INFO: 'SALES_INFO',
  CONTRACT: 'SALES_CONTRACT',
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
    const dateFilter = {
      OR: [
        { createdAt: { gte: startDate, lte: endDate } },
        { updatedAt: { gte: startDate, lte: endDate } },
      ],
    };

    let quotationWhere: any = dateFilter;

    // Filter quotations for sales users to only show their own
    if (!hasPermission(role, 'viewAllQuotations')) {
      const scoped: any[] = [];
      if (session.user.email) scoped.push({ createdBy: session.user.email });
      if (session.user.id) {
        scoped.push({ payload: { path: ['salesManagerId'], equals: session.user.id } });
      }
      if (scoped.length > 0) {
        quotationWhere = {
          AND: [dateFilter, { OR: scoped }],
        };
      } else {
        quotationWhere = {
          ...dateFilter,
          createdBy: session.user.email ?? '__unknown__',
        };
      }
    }

    const quotations = await prisma.appQuotation.findMany({
      where: quotationWhere,
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
      SALES_CREATED: 0,
      SALES_MEET: 0,
      SALES_CONTACT: 0,
      SALES_MEETING: 0,
      SALES_INFO: 0,
      SALES_CONTRACT: 0,
    };

    const pushEvent = (date: Date | null, event: CalendarEvent) => {
      if (!date || !isWithin(date, startDate, endDate)) return;
      const key = formatKey(date);
      const bucket = eventsByDate.get(key) ?? [];
      bucket.push(event);
      eventsByDate.set(key, bucket);
      statusCounts[event.status] = (statusCounts[event.status] ?? 0) + 1;
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
        code: quotation.quotationNumber || title || 'quotation',
        status,
        title,
        description,
      };

      pushEvent(resolvedDate, event);
    }

    // Inject sales tasks into the calendar (created date + current status date)
    if (hasPermission(role, 'accessSalesTasks')) {
      const taskDateFilter = {
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { updatedAt: { gte: startDate, lte: endDate } },
          { meetingDate: { gte: startDate, lte: endDate } },
        ],
      };

      let taskWhere: any = taskDateFilter;

      if (!hasPermission(role, 'viewAllSalesTasks')) {
        const scoped: any[] = [];
        if (session.user.id) {
          scoped.push({ createdById: session.user.id });
          scoped.push({ salesManagerId: session.user.id });
        }
        if (session.user.email) {
          scoped.push({ createdByEmail: session.user.email });
        }
        if (scoped.length > 0) {
          taskWhere = {
            AND: [taskDateFilter, { OR: scoped }],
          };
        } else {
          taskWhere = {
            ...taskDateFilter,
            createdByEmail: session.user.email ?? '__unknown__',
          };
        }
      }

      const salesTasks = await prisma.appSalesTask.findMany({
        where: taskWhere,
        orderBy: { createdAt: 'asc' },
      });

      for (const task of salesTasks) {
        const title = task.title || task.clientName;
        const href = `/sales-tasks?search=${encodeURIComponent(task.clientName || task.title || '')}`;
        const descriptionParts = [task.mainComment, task.originCountry, task.destinationCountry]
          .filter((value): value is string => Boolean(value))
          .map((value) => value.trim())
          .filter(Boolean);
        const description = descriptionParts.join(' • ');

        const createdEvent: CalendarEvent = {
          id: `${task.id}-created`,
          code: task.clientName || title || 'sales-task',
          status: 'SALES_CREATED',
          type: 'salesTask',
          title,
          description: description || 'Sales task created',
          href,
        };

        const rawStatus = (task.status as SalesTaskStatus) || 'MEET';
        const statusKey = SALES_STATUS_TO_CALENDAR[rawStatus] ?? 'SALES_MEET';
        const statusDate = parseDate(task.meetingDate) ?? task.updatedAt ?? task.createdAt;
        const meetingDate = parseDate(task.meetingDate);
        const statusEvent: CalendarEvent = {
          id: `${task.id}-${statusKey.toLowerCase()}`,
          code: task.clientName || title || 'sales-task',
          status: statusKey,
          type: 'salesTask',
          title,
          description: description || task.mainComment || title,
          href,
          time: meetingDate?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        };

        pushEvent(task.createdAt, createdEvent);
        pushEvent(statusDate, statusEvent);
      }
    }

    const sortedEntries = Array.from(eventsByDate.entries())
      .map(([key, events]) => {
        const sorted = events.sort((a, b) => {
          const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          if (orderDiff !== 0) return orderDiff;
          const codeA = a.code || '';
          const codeB = b.code || '';
          return codeA.localeCompare(codeB);
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
    console.error('Calendar API error', error);
    return NextResponse.json(
      {
        error: 'Failed to load dashboard calendar.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
