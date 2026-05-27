/**
 * Inventory Service
 * Handles stock deduction on order acceptance, restoration on cancellation,
 * and recalculation on order edits. Uses Prisma transactions for safety.
 * 
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * Check if all items in an order have sufficient stock.
 * Returns { ok: true } or { ok: false, insufficientItems: [...] }
 */
async function checkStockAvailability(items, tx = prisma) {
  const insufficientItems = [];

  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { id: true, code: true, name: true, stock: true },
    });

    if (!product) {
      insufficientItems.push({
        productCode: item.productCode,
        productName: item.productName,
        requested: item.quantity,
        available: 0,
        error: 'المنتج غير موجود',
      });
      continue;
    }

    if (product.stock < item.quantity) {
      insufficientItems.push({
        productCode: product.code,
        productName: product.name,
        requested: item.quantity,
        available: product.stock,
        error: `المخزون غير كافٍ: مطلوب ${item.quantity}، متوفر ${product.stock}`,
      });
    }
  }

  return insufficientItems.length === 0
    ? { ok: true }
    : { ok: false, insufficientItems };
}

/**
 * Deduct stock for an accepted order.
 * Must be called inside a Prisma transaction.
 * @param {number} orderId
 * @param {PrismaClient} tx - transaction client
 */
async function deductStock(orderId, tx) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error('الطلب غير موجود');
  if (order.stockDeducted) return; // Already deducted — idempotent

  // Check availability first
  const check = await checkStockAvailability(order.items, tx);
  if (!check.ok) {
    const errorDetails = check.insufficientItems
      .map((i) => `${i.productName}: مطلوب ${i.requested}، متوفر ${i.available}`)
      .join('\n');
    throw new Error(`المخزون غير كافٍ لقبول الطلب:\n${errorDetails}`);
  }

  // Deduct stock for each item
  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    });

    logger.logInventory({
      action: 'DEDUCT',
      orderId,
      productId: item.productId,
      productCode: item.productCode,
      quantity: item.quantity,
    });
  }

  // Mark order as stock-deducted
  await tx.order.update({
    where: { id: orderId },
    data: { stockDeducted: true, acceptedAt: new Date() },
  });

  logger.logInventory({
    action: 'ORDER_ACCEPTED',
    orderId,
    orderNumber: order.orderNumber,
    itemCount: order.items.length,
  });
}

/**
 * Restore stock for a cancelled/rejected order.
 * Only restores if stock was previously deducted.
 * Must be called inside a Prisma transaction.
 */
async function restoreStock(orderId, tx) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error('الطلب غير موجود');
  if (!order.stockDeducted) return; // Nothing to restore

  // Restore stock for each item
  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });

    logger.logInventory({
      action: 'RESTORE',
      orderId,
      productId: item.productId,
      productCode: item.productCode,
      quantity: item.quantity,
    });
  }

  // Mark order as stock not deducted
  await tx.order.update({
    where: { id: orderId },
    data: { stockDeducted: false },
  });

  logger.logInventory({
    action: 'ORDER_REJECTED_STOCK_RESTORED',
    orderId,
    orderNumber: order.orderNumber,
  });
}

/**
 * Handle stock recalculation when order items are edited on an accepted order.
 * Restores old quantities and deducts new quantities atomically.
 * @param {number} orderId
 * @param {Array} oldItems - previous order items
 * @param {Array} newItems - new order items
 * @param {PrismaClient} tx - transaction client
 */
async function recalculateStock(orderId, oldItems, newItems, tx) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order || !order.stockDeducted) return;

  // Build maps: productId -> quantity
  const oldMap = {};
  for (const item of oldItems) {
    oldMap[item.productId] = (oldMap[item.productId] || 0) + item.quantity;
  }

  const newMap = {};
  for (const item of newItems) {
    newMap[item.productId] = (newMap[item.productId] || 0) + item.quantity;
  }

  // Get all unique product IDs
  const allProductIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

  for (const pidStr of allProductIds) {
    const pid = parseInt(pidStr);
    const oldQty = oldMap[pid] || 0;
    const newQty = newMap[pid] || 0;
    const diff = newQty - oldQty;

    if (diff === 0) continue;

    if (diff > 0) {
      // Need more stock — check availability
      const product = await tx.product.findUnique({ where: { id: pid } });
      if (product && product.stock < diff) {
        throw new Error(`المخزون غير كافٍ لـ ${product.name}: مطلوب ${diff} إضافي، متوفر ${product.stock}`);
      }
      await tx.product.update({
        where: { id: pid },
        data: { stock: { decrement: diff } },
      });

      logger.logInventory({ action: 'RECALC_DEDUCT', orderId, productId: pid, diff });
    } else {
      // Returning stock
      await tx.product.update({
        where: { id: pid },
        data: { stock: { increment: Math.abs(diff) } },
      });

      logger.logInventory({ action: 'RECALC_RESTORE', orderId, productId: pid, diff: Math.abs(diff) });
    }
  }
}

/**
 * Restore stock for returned items.
 * @param {Array} returnItems - [{ productId, quantity }]
 * @param {PrismaClient} tx - transaction client
 */
async function restoreReturnedStock(returnItems, tx) {
  for (const item of returnItems) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });

    logger.logInventory({
      action: 'RETURN_RESTORE',
      productId: item.productId,
      quantity: item.quantity,
    });
  }
}

module.exports = {
  checkStockAvailability,
  deductStock,
  restoreStock,
  recalculateStock,
  restoreReturnedStock,
};
