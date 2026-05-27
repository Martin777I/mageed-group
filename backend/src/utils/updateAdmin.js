/**
 * MAGEED GROUP — Update Admin Credentials
 * Usage: node src/utils/updateAdmin.js <email> <password> [name]
 *
 * Examples:
 *   node src/utils/updateAdmin.js newadmin@mageed.com MyNewPassword123
 *   node src/utils/updateAdmin.js newadmin@mageed.com MyNewPassword123 "اسم الأدمن"
 */

const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

async function updateAdmin() {
  const [,, newEmail, newPassword, newName] = process.argv;

  if (!newEmail || !newPassword) {
    console.log('\n❌ Usage: node src/utils/updateAdmin.js <email> <password> [name]\n');
    console.log('Examples:');
    console.log('  node src/utils/updateAdmin.js admin@mysite.com MySecurePass123');
    console.log('  node src/utils/updateAdmin.js admin@mysite.com MySecurePass123 "Martin"');
    process.exit(1);
  }

  try {
    // Find the first admin
    const admin = await prisma.admin.findFirst();
    if (!admin) {
      console.log('\n❌ No admin found in database. Run seed first: npm run seed\n');
      process.exit(1);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update admin
    const data = {
      email: newEmail,
      password: hashedPassword,
    };
    if (newName) data.name = newName;

    const updated = await prisma.admin.update({
      where: { id: admin.id },
      data,
    });

    console.log('\n✅ Admin credentials updated successfully!');
    console.log(`   Email: ${updated.email}`);
    console.log(`   Name: ${updated.name}`);
    console.log(`   Password: ******* (updated)\n`);
  } catch (error) {
    console.error('\n❌ Error:', error.message, '\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdmin();
