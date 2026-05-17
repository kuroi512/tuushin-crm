import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { buildSalesMatchKey } from '@/lib/sales-kpi';
import { resolveExternalShipmentSalesLabel } from '@/lib/external-shipment-sales-filter';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(session.user.role);
    if (!hasPermission(role, 'accessReports')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shipments = await prisma.externalShipment.findMany({
      select: {
        salesManager: true,
        manager: true,
      },
    });

    const salesMap = new Map<string, { name: string; matchKey: string }>();

    for (const shipment of shipments) {
      const name = resolveExternalShipmentSalesLabel(shipment);
      const matchKey = buildSalesMatchKey(name);
      if (!salesMap.has(matchKey)) {
        salesMap.set(matchKey, { name, matchKey });
      }
    }

    const sales = Array.from(salesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'mn', { sensitivity: 'base' }),
    );

    return NextResponse.json({
      success: true,
      data: { sales },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Failed to load external shipment sales list.', details: message },
      { status: 500 },
    );
  }
}
