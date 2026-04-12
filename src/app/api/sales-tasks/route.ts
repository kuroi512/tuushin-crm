import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { SALES_TASK_STAGE_ORDER, type SalesTask, type SalesTaskStatus } from '@/types/sales-task';
import {
  applyStatusesToSalesTaskProgress,
  applyStatusToSalesTaskProgress,
  ensureSalesTaskProgress,
} from '@/lib/sales-task-progress';
import { fromDbSalesTaskStatus, toDbSalesTaskStatus } from '@/lib/sales-task-status';

const STATUS_VALUES = SALES_TASK_STAGE_ORDER;

const createSchema = z.object({
  title: z.string().max(120).optional().nullable(),
  clientName: z.string().min(1, 'Client is required'),
  salesManagerId: z.string().optional().nullable(),
  salesManagerName: z.string().optional().nullable(),
  originCountry: z.string().optional().nullable(),
  destinationCountry: z.string().optional().nullable(),
  commodity: z.string().optional().nullable(),
  mainComment: z.string().optional().nullable(),
  status: z.enum(STATUS_VALUES).optional(),
  statuses: z.array(z.enum(STATUS_VALUES)).optional(),
});

function mapTask(row: any): SalesTask {
  return {
    id: row.id,
    title: row.title,
    clientName: row.clientName,
    salesManagerId: row.salesManagerId,
    salesManagerName: row.salesManagerName,
    originCountry: row.originCountry,
    destinationCountry: row.destinationCountry,
    commodity: row.commodity,
    mainComment: row.mainComment,
    status: fromDbSalesTaskStatus(row.status),
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
  const statusFilter = url.searchParams.get('status')?.toUpperCase() || '';
  const salesManagerIdFilter = url.searchParams.get('salesManagerId')?.trim();

  const where: any = {};
  const statusFilters = statusFilter
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is SalesTaskStatus => STATUS_VALUES.includes(entry as SalesTaskStatus));
  if (statusFilters.length === 1) {
    where.status = toDbSalesTaskStatus(statusFilters[0]);
  } else if (statusFilters.length > 1) {
    where.status = { in: statusFilters.map((entry) => toDbSalesTaskStatus(entry)) };
  }

  // Sales manager filter
  if (salesManagerIdFilter) {
    where.salesManagerId = salesManagerIdFilter;
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

    if (!resolvedSalesManagerId && role === 'SALES') {
      const sessionUserId = session.user.id;
      if (sessionUserId) {
        const currentSalesUser = await prisma.user.findUnique({ where: { id: sessionUserId } });
        resolvedSalesManagerId = sessionUserId;
        resolvedSalesManagerName =
          resolvedSalesManagerName ||
          currentSalesUser?.name ||
          currentSalesUser?.email ||
          session.user.name ||
          session.user.email ||
          undefined;
      }
    }

    if (!resolvedSalesManagerName && role === 'SALES') {
      resolvedSalesManagerName = session.user.name || session.user.email || undefined;
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

    const selectedStatuses = Array.from(
      new Set(
        (payload.statuses?.length
          ? payload.statuses
          : payload.status
            ? [payload.status]
            : ['MAIL']) as SalesTaskStatus[],
      ),
    ).filter((status): status is SalesTaskStatus => STATUS_VALUES.includes(status));

    const sortedStatuses = [...selectedStatuses].sort(
      (left, right) => STATUS_VALUES.indexOf(left) - STATUS_VALUES.indexOf(right),
    );
    const currentStatus: SalesTaskStatus =
      sortedStatuses[sortedStatuses.length - 1] || payload.status || 'MAIL';
    const dbStatus = toDbSalesTaskStatus(currentStatus);
    const progress = applyStatusesToSalesTaskProgress(sortedStatuses, {
      userName: createdByName,
      userEmail: createdByEmail,
      at: now,
    });
    const progressJson = progress as unknown as Prisma.JsonObject;

    const created = await prisma.appSalesTask.create({
      data: {
        title: payload.title || undefined,
        clientName: payload.clientName,
        salesManagerId: resolvedSalesManagerId,
        salesManagerName: resolvedSalesManagerName,
        originCountry: payload.originCountry || undefined,
        destinationCountry: payload.destinationCountry || undefined,
        commodity: payload.commodity || undefined,
        mainComment: payload.mainComment || undefined,
        status: dbStatus,
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

    await prisma.appSalesTaskStatusLog.createMany({
      data: sortedStatuses.map((status, index) => ({
        taskId: created.id,
        status: toDbSalesTaskStatus(status),
        completed: true,
        comment:
          index === sortedStatuses.length - 1
            ? payload.mainComment || 'Task created'
            : `Task created with ${status} stage`,
        createdById,
        createdByName,
        createdByEmail,
      })),
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
