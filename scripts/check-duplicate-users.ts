import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    console.log('Checking for duplicate users...\n');

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
      orderBy: { name: 'asc' },
    });

    console.log(`Total SALES users: ${salesUsers.length}\n`);

    // Check for duplicates by email
    const emailMap = new Map<string, typeof salesUsers>();
    salesUsers.forEach((user) => {
      const email = user.email.toLowerCase();
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push(user);
    });

    const duplicatesByEmail = Array.from(emailMap.entries()).filter(
      ([_, users]) => users.length > 1,
    );

    if (duplicatesByEmail.length > 0) {
      console.log('=== DUPLICATE USERS BY EMAIL ===');
      duplicatesByEmail.forEach(([email, users]) => {
        console.log(`\nEmail: ${email} (${users.length} users)`);
        users.forEach((user) => {
          console.log(`  - ID: ${user.id}, Name: ${user.name}, Created: ${user.createdAt}`);
        });
      });
      console.log('\n');
    } else {
      console.log('No duplicate emails found.\n');
    }

    // Check for duplicates by name
    const nameMap = new Map<string, typeof salesUsers>();
    salesUsers.forEach((user) => {
      const name = (user.name || '').toLowerCase();
      if (name) {
        if (!nameMap.has(name)) {
          nameMap.set(name, []);
        }
        nameMap.get(name)!.push(user);
      }
    });

    const duplicatesByName = Array.from(nameMap.entries()).filter(([_, users]) => users.length > 1);

    if (duplicatesByName.length > 0) {
      console.log('=== DUPLICATE USERS BY NAME ===');
      duplicatesByName.forEach(([name, users]) => {
        console.log(`\nName: ${name} (${users.length} users)`);
        users.forEach((user) => {
          console.log(`  - ID: ${user.id}, Email: ${user.email}, Created: ${user.createdAt}`);
        });
      });
      console.log('\n');
    } else {
      console.log('No duplicate names found.\n');
    }

    // List all users for reference
    console.log('=== ALL SALES USERS ===');
    salesUsers.forEach((user) => {
      console.log(`- ${user.name || '(no name)'} (${user.email}) - ID: ${user.id}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
