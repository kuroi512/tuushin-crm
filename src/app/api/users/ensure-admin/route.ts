import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(_req: NextRequest) {
  try {
    const url = new URL(_req.url);
    const reset = (url.searchParams.get('reset') || '').toLowerCase();
    const shouldReset = reset === '1' || reset === 'true' || reset === 'yes';
    const email = 'admin@freight.mn';
    const name = 'System Administrator';
    const password = 'admin123';
    const role = 'ADMIN' as const;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (shouldReset) {
        const newHash = await bcrypt.hash(password, 12);
        const updated = await prisma.user.update({
          where: { email },
          data: { password: newHash, isActive: true },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });
        return NextResponse.json({
          success: true,
          data: updated,
          message: 'Admin password reset',
          defaultPassword: password,
        });
      }
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
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Failed to ensure admin', detail: msg },
      { status: 500 },
    );
  }
}

export async function GET(_req: NextRequest) {
  try {
    const email = 'admin@freight.mn';
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });
    if (!existing) return NextResponse.json({ success: true, exists: false });
    return NextResponse.json({ success: true, exists: true, data: existing });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Failed to check admin', detail: msg },
      { status: 500 },
    );
  }
}
