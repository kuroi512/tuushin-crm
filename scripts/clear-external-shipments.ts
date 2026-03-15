import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearExternalShipmentData() {
  try {
    console.log('Checking current external shipment data...');

    const [shipmentCountBefore, syncLogCountBefore] = await Promise.all([
      prisma.externalShipment.count(),
      prisma.externalShipmentSyncLog.count(),
    ]);

    console.log(`ExternalShipment rows: ${shipmentCountBefore}`);
    console.log(`ExternalShipmentSyncLog rows: ${syncLogCountBefore}`);

    console.log('\nDeleting external shipment data and sync history...');

    const [deletedShipments, deletedLogs] = await prisma.$transaction([
      prisma.externalShipment.deleteMany({}),
      prisma.externalShipmentSyncLog.deleteMany({}),
    ]);

    const [shipmentCountAfter, syncLogCountAfter] = await Promise.all([
      prisma.externalShipment.count(),
      prisma.externalShipmentSyncLog.count(),
    ]);

    console.log('\nDone.');
    console.log(`Deleted ExternalShipment rows: ${deletedShipments.count}`);
    console.log(`Deleted ExternalShipmentSyncLog rows: ${deletedLogs.count}`);
    console.log(`Remaining ExternalShipment rows: ${shipmentCountAfter}`);
    console.log(`Remaining ExternalShipmentSyncLog rows: ${syncLogCountAfter}`);
  } finally {
    await prisma.$disconnect();
  }
}

clearExternalShipmentData().catch((error) => {
  console.error('Failed to clear external shipment data:', error);
  process.exitCode = 1;
});
