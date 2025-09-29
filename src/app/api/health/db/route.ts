import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const startedAt = Date.now();
  try {
    // Simple connectivity check
    await prisma.$queryRaw`SELECT 1`;

    // Basic counts to "show it's there"
    const [users, masterOptions, appQuotations] = await Promise.all([
      prisma.user.count(),
      prisma.masterOption.count(),
      prisma.appQuotation.count(),
    ]);

    const elapsedMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      provider: 'postgresql',
      latencyMs: elapsedMs,
      counts: { users, masterOptions, appQuotations },
    });
  } catch (err: any) {
    const elapsedMs = Date.now() - startedAt;
    return NextResponse.json(
      {
        ok: false,
        latencyMs: elapsedMs,
        error: err?.message || 'Database unreachable',
      },
      { status: 500 },
    );
  }
}
