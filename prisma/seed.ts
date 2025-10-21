// Seeder to ensure a default admin user exists for testing
// Run: pnpm run seed

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@freight.mn';
  const plainPassword = 'admin123';
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash, isActive: true },
    create: {
      name: 'System Administrator',
      email,
      password: passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('🌱 Seeded admin user');
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: ${plainPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
