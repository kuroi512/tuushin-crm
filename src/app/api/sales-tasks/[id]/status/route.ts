import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import {
  SALES_TASK_STAGE_ORDER,
  type SalesTaskStatus,
  type SalesTaskStatusLog,
} from '@/types/sales-task';
import { applyStatusToSalesTaskProgress, ensureSalesTaskProgress } from '@/lib/sales-task-progress';

const STATUS_VALUES = SALES_TASK_STAGE_ORDER;

const updateSchema = z.object({
  status: z.enum(STATUS_VALUES),
  comment: z.string().max(2000).optional().nullable(),
});

function mapLog(row: any): SalesTaskStatusLog {
  return {
    id: row.id,
    status: row.status,
    completed: row.completed ?? true,
    comment: row.comment,
    createdByName: row.createdByName,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessSalesTasks')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing task id' }, { status: 400 });
    }

    const task = await prisma.appSalesTask.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const canViewAll = hasPermission(role, 'viewAllSalesTasks');
    if (!canViewAll) {
      const userId = session.user.id;
      const userEmail = session.user.email;
      const ownsTask =
        (userId && (task.createdById === userId || task.salesManagerId === userId)) ||
        (userEmail && task.createdByEmail === userEmail);
      if (!ownsTask) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const logs = await prisma.appSalesTaskStatusLog.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: logs.map(mapLog),
    });
  } catch (error: any) {
    console.error('Failed to load status log', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load status log', details: error?.message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageSalesTasks')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing task id' }, { status: 400 });
    }

    const task = await prisma.appSalesTask.findUnique({ where: { id } });
    if (!task) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const canViewAll = hasPermission(role, 'viewAllSalesTasks');
    if (!canViewAll) {
      const userId = session.user.id;
      const userEmail = session.user.email;
      const ownsTask =
        (userId && (task.createdById === userId || task.salesManagerId === userId)) ||
        (userEmail && task.createdByEmail === userEmail);
      if (!ownsTask) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const status: SalesTaskStatus = payload.status;
    const updatedProgress = applyStatusToSalesTaskProgress(task.progress, status, {
      userName: session.user.name,
      userEmail: session.user.email,
    });

    const updated = await prisma.appSalesTask.update({
      where: { id },
      data: {
        status,
        progress: updatedProgress as unknown as Prisma.JsonObject,
      },
    });

    const log = await prisma.appSalesTaskStatusLog.create({
      data: {
        taskId: id,
        status,
        completed: true,
        comment: payload.comment || undefined,
        createdById: session.user.id || undefined,
        createdByName: session.user.name || undefined,
        createdByEmail: session.user.email || undefined,
      },
    });

    await auditLog({
      action: 'sales_task.status.update',
      resource: 'sales_task',
      resourceId: id,
      userId: session.user.id,
      userEmail: session.user.email,
      ip: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
      metadata: payload,
    });

    return NextResponse.json({
      success: true,
      data: {
        task: {
          id: updated.id,
          status: updated.status,
          updatedAt: updated.updatedAt.toISOString(),
          progress: ensureSalesTaskProgress(updated.progress),
        },
        log: mapLog(log),
      },
    });
  } catch (error: any) {
    console.error('Failed to update status', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update status', details: error?.message },
      { status: 500 },
    );
  }
}
