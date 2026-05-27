/**
 * Return Service
 * Handles return processing, validation, and stock restoration.
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { restoreReturnedStock } = require('./inventoryService');

/**
 * Generate return number: RTN-YYMMDD-XXXX
 */
function generateReturnNumber() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const r = Math.floor(1000 + Math.random() * 9000);
  return `RTN-${y}${m}${day}-${r}`;
}

/**
 * Get already-returned quantities for an order.
 * Returns Map<productId, totalReturnedQty>
 */
async function getReturnedQuantities(orderId) {
  const existingReturns = await prisma.return.findMany({
    where: { orderId },
    include: { items: true },
  });

  const returnedMap = new Map();
  for (const ret of existingReturns) {
    for (const item of ret.items) {
      const prev = returnedMap.get(item.productId) || 0;
      returnedMap.set(item.productId, prev + item.quantity);
    }
  }

  return returnedMap;
}

/**
 * Validate return items against order items.
 * Ensures quantities don't exceed purchased - already returned.
 * @returns { ok, errors, validItems }
 */
async function validateReturnItems(orderId, returnItems) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) return { ok: false, errors: ['الطلب غير موجود'] };
  if (order.status !== 'accepted') return { ok: false, errors: ['لا يمكن الإرجاع إلا من طلبات مقبولة'] };

  const returnedMap = await getReturnedQuantities(orderId);
  const errors = [];
  const validItems = [];

  // Build order items map: productId -> { quantity, price, name }
  const orderItemsMap = {};
  for (const oi of order.items) {
    if (!orderItemsMap[oi.productId]) {
      orderItemsMap[oi.productId] = { quantity: 0, price: oi.price, name: oi.productName, code: oi.productCode };
    }
    orderItemsMap[oi.productId].quantity += oi.quantity;
  }

  for (const ri of returnItems) {
    const productId = ri.productId;
    const requestedQty = parseInt(ri.quantity);

    if (!requestedQty || requestedQty <= 0) {
      errors.push(`كمية إرجاع غير صالحة للمنتج ${ri.productId}`);
      continue;
    }

    const orderItem = orderItemsMap[productId];
    if (!orderItem) {
      errors.push(`المنتج ${productId} غير موجود في هذا الطلب`);
      continue;
    }

    const alreadyReturned = returnedMap.get(productId) || 0;
    const maxReturnable = orderItem.quantity - alreadyReturned;

    if (requestedQty > maxReturnable) {
      errors.push(
        `${orderItem.name}: الكمية المطلوبة (${requestedQty}) تتجاوز المتاح للإرجاع (${maxReturnable}). ` +
        `مشتراة: ${orderItem.quantity}، مُرجعة سابقاً: ${alreadyReturned}`
      );
      continue;
    }

    validItems.push({
      productId,
      quantity: requestedQty,
      price: orderItem.price,
      total: orderItem.price * requestedQty,
    });
  }

  return {
    ok: errors.length === 0 && validItems.length > 0,
    errors,
    validItems,
  };
}

/**
 * Process a return — create return record and restore stock.
 * Uses a Prisma transaction for atomicity.
 */
async function processReturn({ customerId, orderId, items, notes }) {
  const validation = await validateReturnItems(orderId, items);
  if (!validation.ok) {
    return { success: false, errors: validation.errors };
  }

  const totalAmount = validation.validItems.reduce((sum, i) => sum + i.total, 0);

  const result = await prisma.$transaction(async (tx) => {
    // Generate unique return number with retry
    let returnNumber;
    let retries = 0;
    do {
      returnNumber = generateReturnNumber();
      const existing = await tx.return.findUnique({ where: { returnNumber } });
      if (!existing) break;
      retries++;
    } while (retries < 5);

    const returnRecord = await tx.return.create({
      data: {
        returnNumber,
        customerId,
        orderId,
        totalAmount,
        notes: notes || null,
        items: {
          create: validation.validItems,
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Restore stock
    await restoreReturnedStock(validation.validItems, tx);

    logger.logReturn({
      action: 'CREATED',
      returnNumber,
      orderId,
      customerId,
      totalAmount,
      itemCount: validation.validItems.length,
    });

    return returnRecord;
  }, { timeout: 30000 });

  return { success: true, return: result };
}

module.exports = {
  generateReturnNumber,
  getReturnedQuantities,
  validateReturnItems,
  processReturn,
};
