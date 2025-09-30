import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '20')));
  const action = url.searchParams.get('action') || undefined;
  const resource = url.searchParams.get('resource') || undefined;
  const userEmail = url.searchParams.get('userEmail') || undefined;

  const where: any = {};
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (resource) where.resource = { contains: resource, mode: 'insensitive' };
  if (userEmail) where.userEmail = { contains: userEmail, mode: 'insensitive' };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        action: true,
        resource: true,
        resourceId: true,
        userId: true,
        userEmail: true,
        ip: true,
        userAgent: true,
        metadata: true,
      },
    }),
  ]);

  return NextResponse.json({ success: true, pagination: { page, pageSize, total }, data: rows });
}
