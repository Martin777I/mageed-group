/**
 * Customer Service
 * Auto-creation from orders, code generation, lookup by phone.
 * Uses singleton PrismaClient.
 */

const prisma = require('../config/prisma');

/**
 * Generate the next customer code: CUS-0001, CUS-0002, etc.
 */
async function generateCustomerCode() {
  const lastCustomer = await prisma.customer.findFirst({
    orderBy: { id: 'desc' },
    select: { customerCode: true },
  });

  if (!lastCustomer) return 'CUS-0001';

  const match = lastCustomer.customerCode.match(/CUS-(\d+)/);
  if (!match) return 'CUS-0001';

  const nextNum = parseInt(match[1]) + 1;
  return `CUS-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Find or create a customer by phone number.
 * Used during order creation to auto-link customers.
 * @returns {Customer} - the found or created customer
 */
async function findOrCreateCustomer({ name, phone, address, notes }, tx = prisma) {
  const cleanPhone = phone.trim();

  // Try to find existing
  let customer = await tx.customer.findUnique({
    where: { phone: cleanPhone },
  });

  if (customer) {
    // Update name if it changed
    if (customer.name !== name.trim()) {
      customer = await tx.customer.update({
        where: { id: customer.id },
        data: { name: name.trim() },
      });
    }
    return customer;
  }

  // Create new customer with retry for code collisions
  let retries = 0;
  while (retries < 3) {
    try {
      const customerCode = await generateCustomerCode();
      customer = await tx.customer.create({
        data: {
          customerCode,
          name: name.trim(),
          phone: cleanPhone,
          address: address || null,
          notes: notes || null,
        },
      });
      return customer;
    } catch (err) {
      // P2002 = unique constraint violation (race condition on code)
      if (err.code === 'P2002' && err.meta?.target?.includes('customer_code')) {
        retries++;
        continue;
      }
      throw err;
    }
  }

  throw new Error('فشل في إنشاء كود عميل فريد بعد عدة محاولات');
}

/**
 * Get customer statistics
 */
async function getCustomerStats(customerId) {
  const [totalOrders, totalReturns, ordersData, returnsData, lastOrder] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.return.count({ where: { customerId } }),
    prisma.order.aggregate({
      where: { customerId, status: 'accepted' },
      _sum: { totalAmount: true },
    }),
    prisma.return.aggregate({
      where: { customerId },
      _sum: { totalAmount: true },
    }),
    prisma.order.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, orderNumber: true },
    }),
  ]);

  return {
    totalOrders,
    totalReturns,
    totalPurchases: ordersData._sum.totalAmount || 0,
    totalReturnsAmount: returnsData._sum.totalAmount || 0,
    netPurchases: (ordersData._sum.totalAmount || 0) - (returnsData._sum.totalAmount || 0),
    lastOrderDate: lastOrder?.createdAt || null,
    lastOrderNumber: lastOrder?.orderNumber || null,
  };
}

module.exports = {
  generateCustomerCode,
  findOrCreateCustomer,
  getCustomerStats,
};
