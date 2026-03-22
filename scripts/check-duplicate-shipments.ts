import { prisma } from '@/lib/db';

async function checkDuplicateShipments() {
  try {
    console.log('🔍 Checking for duplicate external shipments...\n');

    // Get total count
    const totalCount = await prisma.externalShipment.count();
    console.log(`Total shipments in DB: ${totalCount}\n`);

    // Check for duplicates by externalId + category (should be unique)
    const duplicatesByExternalId = (await prisma.$queryRaw`
      SELECT 
        "externalId", 
        "category", 
        COUNT(*) as count,
        array_agg("id") as ids
      FROM external_shipments
      GROUP BY "externalId", "category"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `) as Array<{
      externalId: string;
      category: string;
      count: number;
      ids: string[];
    }>;

    if (duplicatesByExternalId.length > 0) {
      console.log('⚠️  DUPLICATES FOUND BY externalId + category:\n');
      for (const dup of duplicatesByExternalId) {
        console.log(`  externalId: ${dup.externalId}`);
        console.log(`  category: ${dup.category}`);
        console.log(`  count: ${dup.count}`);
        console.log(`  ids: ${dup.ids.join(', ')}\n`);
      }
    } else {
      console.log('✅ No duplicates found by externalId + category (good!)\n');
    }

    // Check for similar records by container + customer + date (might indicate container-level duplicates)
    const similarByContainer = (await prisma.$queryRaw`
      SELECT 
        "containerNumber",
        "customerName",
        DATE("registeredAt") as reg_date,
        COUNT(*) as count,
        COUNT(DISTINCT "externalId") as distinct_ids,
        array_agg(DISTINCT "id") as ids
      FROM external_shipments
      WHERE "containerNumber" IS NOT NULL 
        AND "containerNumber" != ''
      GROUP BY "containerNumber", "customerName", DATE("registeredAt")
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `) as Array<{
      containerNumber: string;
      customerName: string | null;
      reg_date: string;
      count: number;
      distinct_ids: number;
      ids: string[];
    }>;

    if (similarByContainer.length > 0) {
      console.log('📦 POTENTIAL CONTAINER-LEVEL DUPLICATES:\n');
      console.log('(Same container/customer/date with different externalIds)\n');
      for (const sim of similarByContainer) {
        console.log(`  Container: ${sim.containerNumber}`);
        console.log(`  Customer: ${sim.customerName}`);
        console.log(`  Date: ${sim.reg_date}`);
        console.log(`  Total rows: ${sim.count}`);
        console.log(`  Distinct IDs: ${sim.distinct_ids}`);
        console.log(`  Row IDs: ${sim.ids.join(', ')}\n`);
      }
    } else {
      console.log('✅ No potential container-level duplicates found\n');
    }

    // Check for shipments with same number but different containers
    const shipmentNumberDuplicates = (await prisma.$queryRaw`
      SELECT 
        "number",
        "category",
        COUNT(*) as count,
        COUNT(DISTINCT "containerNumber") as unique_containers,
        array_agg(DISTINCT "containerNumber") as containers,
        array_agg(DISTINCT "externalId") as external_ids
      FROM external_shipments
      WHERE "number" IS NOT NULL
      GROUP BY "number", "category"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `) as Array<{
      number: number;
      category: string;
      count: number;
      unique_containers: number;
      containers: (string | null)[];
      external_ids: string[];
    }>;

    if (shipmentNumberDuplicates.length > 0) {
      console.log('🚢 SHIPMENT NUMBER DUPLICATES:\n');
      console.log('(Same shipment number, different containers/IDs)\n');
      for (const dup of shipmentNumberDuplicates) {
        console.log(`  Shipment #: ${dup.number}`);
        console.log(`  Category: ${dup.category}`);
        console.log(`  Total rows: ${dup.count}`);
        console.log(`  Unique containers: ${dup.unique_containers}`);
        console.log(`  Containers: ${dup.containers.join(', ')}`);
        console.log(
          `  External IDs: ${dup.external_ids.length > 3 ? '[' + dup.external_ids.slice(0, 3).join(', ') + ', ...]' : dup.external_ids.join(', ')}\n`,
        );
      }
    } else {
      console.log('✅ No shipment number duplicates found\n');
    }

    console.log('\n✅ Duplicate check complete!');
  } catch (error) {
    console.error('Error checking duplicates:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateShipments();
