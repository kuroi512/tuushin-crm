import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const startedAt = Date.now();
  const healthToken = process.env.INTERNAL_HEALTH_TOKEN;
  try {
    // Simple connectivity check
    await prisma.$queryRaw`SELECT 1`;

    const elapsedMs = Date.now() - startedAt;
    // Do not expose table counts publicly unless explicitly enabled.
    if (!healthToken) {
      return NextResponse.json({
        ok: true,
        provider: 'postgresql',
        latencyMs: elapsedMs,
      });
    }

    const [users, masterOptions, appQuotations] = await Promise.all([
      prisma.user.count(),
      prisma.masterOption.count(),
      prisma.appQuotation.count(),
    ]);
    return NextResponse.json({
      ok: true,
      provider: 'postgresql',
      latencyMs: elapsedMs,
      counts: { users, masterOptions, appQuotations },
    });
  } catch {
    const elapsedMs = Date.now() - startedAt;
    return NextResponse.json(
      {
        ok: false,
        latencyMs: elapsedMs,
        error: 'Database unreachable',
      },
      { status: 500 },
    );
  }
}
