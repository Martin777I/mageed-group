/**
 * MAGED GROUP — Database Seed Script
 * Creates default admin user and sample products.
 * 
 * Usage: node src/utils/seed.js
 */

// Load config (which loads dotenv)
require('../config/config');
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    const existing = await prisma.admin.findUnique({ where: { email: 'admin@MAGED.com' } });
    if (existing) {
      console.log('Admin already exists. Skipping seed.');
      return;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.admin.create({
      data: {
        name: 'مدير النظام',
        email: 'admin@MAGED.com',
        password: hashedPassword,
      },
    });

    // Seed some sample products
    await prisma.product.createMany({
      data: [
        { code: 'BRK-001', name: 'تيل فرامل أمامي', price: 150, category: 'فرامل', stock: 50 },
        { code: 'BRK-002', name: 'تيل فرامل خلفي', price: 120, category: 'فرامل', stock: 40 },
        { code: 'ENG-001', name: 'فلتر زيت', price: 45, category: 'محرك', stock: 100 },
        { code: 'ENG-002', name: 'شمعة إشعال', price: 35, category: 'محرك', stock: 200 },
        { code: 'CHN-001', name: 'سلسلة جنزير', price: 250, category: 'نقل الحركة', stock: 30 },
        { code: 'CHN-002', name: 'ترس أمامي', price: 85, category: 'نقل الحركة', stock: 45 },
        { code: 'TIR-001', name: 'إطار أمامي 90/90', price: 320, category: 'إطارات', stock: 20 },
        { code: 'TIR-002', name: 'إطار خلفي 120/80', price: 380, category: 'إطارات', stock: 15 },
        { code: 'LGT-001', name: 'لمبة فانوس أمامي', price: 65, category: 'كهرباء', stock: 60 },
        { code: 'LGT-002', name: 'لمبة إشارة', price: 25, category: 'كهرباء', stock: 80 },
      ],
    });

    console.log('Seed completed successfully!');
    console.log('Admin: admin@MAGED.com / admin123');
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    const { disconnectPrisma } = require('../config/prisma');
    await disconnectPrisma();
  }
}

seed();
