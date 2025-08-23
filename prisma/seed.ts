// Simple seeder that creates the admin user hash
// Run: pnpm run seed

import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Generating admin user password hash...');

  const adminPassword = await bcrypt.hash('admin123', 12);

  console.log('✅ Admin user details:');
  console.log('   Email: admin@freight.mn');
  console.log('   Password: admin123');
  console.log('   Hashed Password:', adminPassword);
  console.log('');
  console.log('📝 Add this user to your mock data or database:');
  console.log(`{
  id: '1',
  name: 'System Administrator',
  email: 'admin@freight.mn',
  password: '${adminPassword}',
  role: 'ADMIN',
  status: 'ACTIVE',
}`);
  console.log('');
  console.log('🌟 Password hash generation completed!');
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
