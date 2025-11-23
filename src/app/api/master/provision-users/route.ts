import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';

export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageUsers')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const staff = await prisma.masterOption.findMany({
      where: { category: { in: ['SALES', 'MANAGER'] as any }, isActive: true },
      select: { id: true, name: true, meta: true, category: true },
    });

    // compute next index for role-based emails salesN@tuushin.com / managerN@tuushin.com
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
    const existingSales = await prisma.user.findMany({
      where: { email: { startsWith: 'sales', endsWith: '@tuushin.com' } },
      select: { email: true },
    });
    const existingManager = await prisma.user.findMany({
      where: { email: { startsWith: 'manager', endsWith: '@tuushin.com' } },
      select: { email: true },
    });
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
    const hash = await bcrypt.hash(defaultPassword, 10);

    let created = 0;
    let updated = 0;
    for (const s of staff) {
      const role = s.category === 'MANAGER' ? 'MANAGER' : 'SALES';
      const email = (s.meta as any)?.email || nextEmailForRole(role);
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        await prisma.user.update({
          where: { email },
          data: { name: s.name, role: role as any, isActive: true },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: { email, name: s.name, role: role as any, password: hash, isActive: true },
        });
        created++;
      }
      const meta = Object.assign({}, s.meta as any, { email });
      await prisma.masterOption.update({ where: { id: s.id }, data: { meta } });
    }

    return NextResponse.json({ success: true, created, updated, defaultPassword });
  } catch (e: any) {
    console.error('Provision users failed:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
