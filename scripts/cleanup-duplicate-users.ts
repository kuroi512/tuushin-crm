import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  try {
    console.log('Starting duplicate user cleanup...\n');

    // Get all SALES users
    const salesUsers = await prisma.user.findMany({
      where: {
        role: 'SALES',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Total active SALES users: ${salesUsers.length}\n`);

    // Group by name (case-insensitive)
    const nameGroups = new Map<string, typeof salesUsers>();
    salesUsers.forEach((user) => {
      const normalizedName = (user.name || '').toLowerCase().trim();
      if (normalizedName) {
        if (!nameGroups.has(normalizedName)) {
          nameGroups.set(normalizedName, []);
        }
        nameGroups.get(normalizedName)!.push(user);
      }
    });

    // Find duplicates and prepare deactivation list
    const toDeactivate: string[] = [];
    let duplicateCount = 0;

    nameGroups.forEach((users, name) => {
      if (users.length > 1) {
        duplicateCount++;
        console.log(`\n"${name}" has ${users.length} accounts:`);

        // Keep the oldest account (first by createdAt)
        const keepUser = users[0];
        console.log(
          `  ✓ KEEPING: ${keepUser.email} (ID: ${keepUser.id}) - Created: ${keepUser.createdAt}`,
        );

        // Mark others for deactivation
        for (let i = 1; i < users.length; i++) {
          const duplicateUser = users[i];
          console.log(
            `  ✗ DEACTIVATING: ${duplicateUser.email} (ID: ${duplicateUser.id}) - Created: ${duplicateUser.createdAt}`,
          );
          toDeactivate.push(duplicateUser.id);
        }
      }
    });

    console.log(`\n\n=== SUMMARY ===`);
    console.log(`Total users with duplicates: ${duplicateCount}`);
    console.log(`Users to deactivate: ${toDeactivate.length}`);
    console.log(`Users remaining active: ${salesUsers.length - toDeactivate.length}\n`);

    if (toDeactivate.length > 0) {
      console.log('Deactivating duplicate users...');

      const result = await prisma.user.updateMany({
        where: {
          id: { in: toDeactivate },
        },
        data: {
          isActive: false,
        },
      });

      console.log(`✓ Successfully deactivated ${result.count} duplicate users\n`);

      // Show final count
      const finalCount = await prisma.user.count({
        where: {
          role: 'SALES',
          isActive: true,
        },
      });
      console.log(`✓ Total active SALES users now: ${finalCount}`);
    } else {
      console.log('No duplicates found to deactivate.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicates();
