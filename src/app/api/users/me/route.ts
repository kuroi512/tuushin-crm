import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const updateProfileSchema = z
  .object({
    email: z
      .string()
      .email('Please provide a valid email')
      .max(190, 'Email is too long')
      .transform((val) => val.trim().toLowerCase())
      .optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password is too long')
      .optional(),
  })
  .refine((data) => typeof data.email !== 'undefined' || typeof data.password !== 'undefined', {
    message: 'Nothing to update',
  });

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: safeUserSelect });
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: user });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const updates: { email?: string; password?: string } = {};

  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: userId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This email is already in use by another account.' },
        { status: 409 },
      );
    }
    updates.email = data.email;
  }

  if (data.password) {
    updates.password = await bcrypt.hash(data.password, 12);
  }

  if (!updates.email && !updates.password) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: safeUserSelect,
  });

  return NextResponse.json({ success: true, data: updated });
}
