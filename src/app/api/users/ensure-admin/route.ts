import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(_req: NextRequest) {
  try {
    const email = 'admin@freight.mn';
    const name = 'System Administrator';
    const password = 'admin123';
    const role = 'ADMIN' as const;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: true, data: existing, message: 'Admin exists' });
    }
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, password: hash, role: role as any, isActive: true },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({
      success: true,
      data: user,
      message: 'Admin created',
      defaultPassword: password,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to ensure admin' }, { status: 500 });
  }
}
