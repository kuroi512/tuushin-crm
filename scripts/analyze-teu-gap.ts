import { prisma } from '@/lib/db';
import {
  resolveReportTransmodeName,
  getTeuWeightForExternalShipment,
} from '@/lib/external-shipment-transmode';

// Usage: npx tsx scripts/analyze-teu-gap.ts 2026-01-01 2026-06-30 [CATEGORY]
async function main() {
  const [startArg, endArg, categoryArg] = process.argv.slice(2);
  if (!startArg || !endArg) {
    console.log(
      'Usage: tsx scripts/analyze-teu-gap.ts <start YYYY-MM-DD> <end YYYY-MM-DD> [CATEGORY]',
    );
    process.exit(1);
  }
  const start = new Date(`${startArg}T00:00:00.000Z`);
  const end = new Date(`${endArg}T23:59:59.999Z`);

  const where: any = {
    OR: [
      { registeredAt: { gte: start, lte: end } },
      { arrivalAt: { gte: start, lte: end } },
      { transitEntryAt: { gte: start, lte: end } },
    ],
  };
  if (categoryArg) where.category = categoryArg;

  const shipments = await prisma.externalShipment.findMany({
    where,
    select: {
      id: true,
      externalId: true,
      category: true,
      containerNumber: true,
      containerWagonName: true,
      raw: true,
    },
  });

  console.log(`Total shipment rows in range: ${shipments.length}`);

  const bucketCounts: Record<string, number> = {};
  const bucketTeu: Record<string, number> = {};
  const bucketCategories: Record<string, Set<string>> = {};

  for (const s of shipments) {
    const mode = resolveReportTransmodeName(s as any);
    const teu = getTeuWeightForExternalShipment(s as any);
    bucketCounts[mode] = (bucketCounts[mode] ?? 0) + 1;
    bucketTeu[mode] = (bucketTeu[mode] ?? 0) + teu;
    (bucketCategories[mode] ??= new Set()).add(s.category);
  }

  console.log('\n--- Counts by transmode bucket ---');
  for (const key of Object.keys(bucketCounts).sort((a, b) => bucketCounts[b] - bucketCounts[a])) {
    const zeroFlag = bucketTeu[key] === 0 ? '  <-- 0 TEU (check classification)' : '';
    console.log(
      `${key.padEnd(20)} count=${String(bucketCounts[key]).padStart(5)}  teuSum=${String(
        bucketTeu[key],
      ).padStart(8)}  categories=${Array.from(bucketCategories[key]).join(',')}${zeroFlag}`,
    );
  }

  const totalTeu = Object.values(bucketTeu).reduce((a, b) => a + b, 0);
  console.log(`\nTotal shipment rows: ${shipments.length}`);
  console.log(`Total TEU (current formula): ${totalTeu}`);
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
