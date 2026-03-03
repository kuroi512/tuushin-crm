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

    const [users, masterStaff] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'SALES', 'MANAGER'] },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
      prisma.masterOption.findMany({
        where: {
          category: { in: ['SALES', 'MANAGER'] as any },
          isActive: true,
        },
        select: {
          name: true,
          meta: true,
        },
      }),
    ]);

    const normalize = (value?: string | null) => (value || '').trim().toLowerCase();
    const allowedNames = new Set<string>();
    const allowedEmails = new Set<string>();
    const allowedUserIds = new Set<string>();

    for (const entry of masterStaff) {
      const meta = (entry.meta || {}) as Record<string, unknown>;
      const candidateNames = [
        entry.name,
        typeof meta.displayName === 'string' ? meta.displayName : null,
        typeof meta.fullName === 'string' ? meta.fullName : null,
      ];

      for (const name of candidateNames) {
        const normalized = normalize(name);
        if (normalized) allowedNames.add(normalized);
      }

      if (typeof meta.email === 'string') {
        const email = normalize(meta.email);
        if (email) allowedEmails.add(email);
      }
      if (typeof meta.userId === 'string') {
        const userId = meta.userId.trim();
        if (userId) allowedUserIds.add(userId);
      }
    }

    const salesManagers = users.filter((user) => {
      if (user.role === 'ADMIN') return true;

      if (!masterStaff.length) return true;

      if (allowedUserIds.has(user.id)) return true;
      if (allowedEmails.has(normalize(user.email))) return true;
      if (allowedNames.has(normalize(user.name))) return true;

      return false;
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
