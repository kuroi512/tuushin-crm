import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    // This endpoint is used for dropdowns in sales tasks and quotations
    // Sales users need access to see available sales managers
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessSalesTasks') && !hasPermission(role, 'accessQuotations')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all users with SALES or MANAGER role
    const salesManagers = await prisma.user.findMany({
      where: {
        role: { in: ['SALES', 'MANAGER'] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: salesManagers,
    });
  } catch (error: any) {
    console.error('Failed to fetch sales managers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sales managers', details: error?.message },
      { status: 500 },
    );
  }
}
