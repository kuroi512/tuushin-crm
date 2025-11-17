import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { SALES_TASK_STAGE_ORDER, type SalesTask, type SalesTaskStatus } from '@/types/sales-task';
import { applyStatusToSalesTaskProgress, ensureSalesTaskProgress } from '@/lib/sales-task-progress';

const STATUS_VALUES = SALES_TASK_STAGE_ORDER;

const createSchema = z.object({
  title: z.string().max(120).optional().nullable(),
  meetingDate: z.string().datetime().optional().nullable(),
  clientName: z.string().min(1, 'Client is required'),
  salesManagerId: z.string().optional().nullable(),
  salesManagerName: z.string().optional().nullable(),
  originCountry: z.string().optional().nullable(),
  destinationCountry: z.string().optional().nullable(),
  commodity: z.string().optional().nullable(),
  mainComment: z.string().optional().nullable(),
  status: z.enum(STATUS_VALUES).optional(),
});

function mapTask(row: any): SalesTask {
  return {
    id: row.id,
    title: row.title,
    meetingDate: row.meetingDate ? new Date(row.meetingDate).toISOString() : null,
    clientName: row.clientName,
    salesManagerId: row.salesManagerId,
    salesManagerName: row.salesManagerName,
    originCountry: row.originCountry,
    destinationCountry: row.destinationCountry,
    commodity: row.commodity,
    mainComment: row.mainComment,
    status: row.status,
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    progress: ensureSalesTaskProgress(row.progress),
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'accessSalesTasks')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '25')));
  const search = (url.searchParams.get('search') || '').trim();
  const statusFilter = url.searchParams.get('status')?.toUpperCase();
  const salesManagerIdFilter = url.searchParams.get('salesManagerId')?.trim();
  const meetingDateFrom = url.searchParams.get('meetingDateFrom')?.trim();
  const meetingDateTo = url.searchParams.get('meetingDateTo')?.trim();

  const where: any = {};
  if (statusFilter && STATUS_VALUES.includes(statusFilter as SalesTaskStatus)) {
    where.status = statusFilter;
  }

  // Sales manager filter
  if (salesManagerIdFilter) {
    where.salesManagerId = salesManagerIdFilter;
  }

  // Meeting date interval filter
  if (meetingDateFrom || meetingDateTo) {
    const meetingDateFilter: any = {};
    if (meetingDateFrom) {
      const fromDate = new Date(meetingDateFrom);
      if (!isNaN(fromDate.getTime())) {
        meetingDateFilter.gte = fromDate;
      }
    }
    if (meetingDateTo) {
      const toDate = new Date(meetingDateTo);
      if (!isNaN(toDate.getTime())) {
        // Set to end of day
        toDate.setHours(23, 59, 59, 999);
        meetingDateFilter.lte = toDate;
      }
    }
    if (Object.keys(meetingDateFilter).length > 0) {
      where.meetingDate = meetingDateFilter;
    }
  }

  const andFilters: any[] = [];
  if (search) {
    andFilters.push({
      OR: [
        { clientName: { contains: search, mode: 'insensitive' } },
        { salesManagerName: { contains: search, mode: 'insensitive' } },
        { commodity: { contains: search, mode: 'insensitive' } },
        { mainComment: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const canViewAll = hasPermission(role, 'viewAllSalesTasks');
  if (!canViewAll) {
    const userId = session.user.id;
    const userEmail = session.user.email;
    andFilters.push({
      OR: [
        ...(userId ? [{ createdById: userId }, { salesManagerId: userId }] : []),
        ...(userEmail ? [{ createdByEmail: userEmail }] : []),
      ],
    });
  }

  if (andFilters.length) {
    where.AND = andFilters;
  }

  const [total, rows] = await Promise.all([
    prisma.appSalesTask.count({ where }),
    prisma.appSalesTask.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const data = rows.map(mapTask);
  return NextResponse.json({
    success: true,
    pagination: { page, pageSize, total },
    data,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageSalesTasks')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const now = new Date();
    const meetingDate = payload.meetingDate ? new Date(payload.meetingDate) : undefined;

    let resolvedSalesManagerId: string | undefined;
    let resolvedSalesManagerName = payload.salesManagerName || undefined;

    if (payload.salesManagerId) {
      const salesManager = await prisma.user.findUnique({ where: { id: payload.salesManagerId } });
      if (salesManager) {
        resolvedSalesManagerId = salesManager.id;
        resolvedSalesManagerName =
          resolvedSalesManagerName || salesManager.name || salesManager.email || undefined;
      } else {
        console.warn('Sales manager id not found, storing name only', {
          salesManagerId: payload.salesManagerId,
        });
      }
    }

    let createdById = session.user.id || undefined;
    let createdByName = session.user.name || undefined;
    let createdByEmail = session.user.email || undefined;

    if (createdById) {
      const creator = await prisma.user.findUnique({ where: { id: createdById } });
      if (!creator) {
        console.warn('Creator id not found, defaulting to contact details only', { createdById });
        createdById = undefined;
        createdByName = createdByName || createdByEmail || undefined;
      } else {
        createdByName = createdByName || creator.name || creator.email || undefined;
        createdByEmail = createdByEmail || creator.email || undefined;
      }
    }

    const status: SalesTaskStatus = payload.status || 'MEET';
    const progress = applyStatusToSalesTaskProgress(undefined, status, {
      userName: createdByName,
      userEmail: createdByEmail,
      at: now,
    });
    const progressJson = progress as unknown as Prisma.JsonObject;

    const created = await prisma.appSalesTask.create({
      data: {
        title: payload.title || undefined,
        meetingDate,
        clientName: payload.clientName,
        salesManagerId: resolvedSalesManagerId,
        salesManagerName: resolvedSalesManagerName,
        originCountry: payload.originCountry || undefined,
        destinationCountry: payload.destinationCountry || undefined,
        commodity: payload.commodity || undefined,
        mainComment: payload.mainComment || undefined,
        status,
        progress: progressJson,
        createdById,
        createdByName,
        createdByEmail,
        payload: {
          formVersion: 1,
          createdAt: now.toISOString(),
        },
      },
    });

    await prisma.appSalesTaskStatusLog.create({
      data: {
        taskId: created.id,
        status: created.status,
        completed: true,
        comment: payload.mainComment || 'Task created',
        createdById,
        createdByName,
        createdByEmail,
      },
    });

    await auditLog({
      action: 'sales_task.create',
      resource: 'sales_task',
      resourceId: created.id,
      userId: session.user.id,
      userEmail: session.user.email,
      ip: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
      metadata: payload,
    });

    return NextResponse.json({ success: true, data: mapTask(created) }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create sales task', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create sales task', details: error?.message },
      { status: 500 },
    );
  }
}
