import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { auditLog } from '@/lib/audit';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any).role as string | undefined;
    const allowed = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER';
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!target) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const defaultPassword = 'test123';
    const hash = await bcrypt.hash(defaultPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hash, isActive: true } });

    await auditLog({
      action: 'user.password_reset',
      resource: 'user',
      resourceId: id,
      userId: session.user.id,
      userEmail: session.user.email || undefined,
      ip: getIpFromHeaders(req.headers),
      userAgent: getUserAgentFromHeaders(req.headers),
      metadata: { targetEmail: target.email, method: 'default_reset' },
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset to default',
      defaultPassword,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 },
    );
  }
}
