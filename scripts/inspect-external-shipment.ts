import { prisma } from '@/lib/db';

async function main() {
  const shipments = await prisma.externalShipment.findMany({
    take: 5,
    orderBy: { syncedAt: 'desc' },
  });
  for (const shipment of shipments) {
    console.log('Shipment', {
      id: shipment.id,
      category: shipment.category,
      currencyCode: shipment.currencyCode,
      totalAmount: shipment.totalAmount,
      profitMnt: shipment.profitMnt,
      profitCurrency: shipment.profitCurrency,
      rawTotalAmount: shipment.raw ? (shipment.raw as Record<string, unknown>).totalamount : null,
      rawProfitTugrik: shipment.raw ? (shipment.raw as Record<string, unknown>).ashig_tugrik : null,
      rawProfitValute: shipment.raw ? (shipment.raw as Record<string, unknown>).ashig_valute : null,
      keys: shipment.raw ? Object.keys(shipment.raw as Record<string, unknown>) : [],
    });
    if (shipment.raw) {
      console.dir(shipment.raw, { depth: 1, colors: false });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
