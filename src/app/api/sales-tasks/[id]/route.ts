import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';
import { hasPermission, normalizeRole } from '@/lib/permissions';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    await prisma.appSalesTaskStatusLog.deleteMany({ where: { taskId: id } });
    await prisma.appSalesTask.delete({ where: { id } });

    await auditLog({
      action: 'sales_task.delete',
      resource: 'sales_task',
      resourceId: id,
      userId: session.user.id,
      userEmail: session.user.email,
      ip: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete sales task', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete sales task', details: error?.message },
      { status: 500 },
    );
  }
}
