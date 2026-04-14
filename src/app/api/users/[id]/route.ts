import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { auditLog } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { getIpFromHeaders, getUserAgentFromHeaders } from '@/lib/request';
import { hasPermission, normalizeRole } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const role = normalizeRole(session.user.role);
  if (!hasPermission(role, 'viewUsers')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: user });
}

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional().nullable(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'SALES']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional(),
  })
  .strict();

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'manageUsers')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const data: any = { ...parsed.data };
    if (Object.prototype.hasOwnProperty.call(data, 'phone')) {
      data.phone = typeof data.phone === 'string' ? data.phone.trim() || null : null;
    }
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const before = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true, phone: true, role: true, isActive: true },
    });

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await auditLog({
      action: 'user.update',
      resource: 'user',
      resourceId: id,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      ip: getIpFromHeaders(req.headers),
      userAgent: getUserAgentFromHeaders(req.headers),
      metadata: {
        before,
        after: {
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          role: updated.role,
          isActive: updated.isActive,
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'deleteUsers')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (session.user.id === id) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account.' },
        { status: 400 },
      );
    }

    const before = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!before) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    await auditLog({
      action: 'user.delete',
      resource: 'user',
      resourceId: id,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      ip: getIpFromHeaders(req.headers),
      userAgent: getUserAgentFromHeaders(req.headers),
      metadata: { before },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
  }
}
