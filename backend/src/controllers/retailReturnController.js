/**
 * MAGED GROUP — Retail Return Controller (مرتجعات القطاعي)
 * Returns for retail invoices with stock restoration.
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { restoreReturnedStock } = require('../utils/inventoryService');
const { logAudit } = require('../utils/auditService');

/**
 * Generate retail return number: RRT-YYMMDD-XXXX
 */
function generateRetailReturnNumber() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const r = Math.floor(1000 + Math.random() * 9000);
  return `RRT-${y}${m}${day}-${r}`;
}

/**
 * Get already-returned quantities for a retail invoice.
 * Returns Map<productId, totalReturnedQty>
 */
async function getRetailReturnedQuantities(invoiceId) {
  const existingReturns = await prisma.retailReturn.findMany({
    where: { invoiceId },
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

// POST /api/retail-returns — create a retail return
exports.createRetailReturn = async (req, res) => {
  try {
    const { invoiceId, invoiceNumber, items, notes } = req.body;

    // Find invoice by ID or number
    let invoice;
    if (invoiceId) {
      invoice = await prisma.retailInvoice.findUnique({
        where: { id: parseInt(invoiceId) },
        include: { items: true },
      });
    } else if (invoiceNumber) {
      invoice = await prisma.retailInvoice.findUnique({
        where: { invoiceNumber },
        include: { items: true },
      });
    }

    if (!invoice) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    if (!items || !items.length) {
      return res.status(400).json({ message: 'بيانات الإرجاع غير مكتملة' });
    }

    // Validate return items against invoice items
    const returnedMap = await getRetailReturnedQuantities(invoice.id);

    // Build invoice items map
    const invoiceItemsMap = {};
    for (const ii of invoice.items) {
      if (!invoiceItemsMap[ii.productId]) {
        invoiceItemsMap[ii.productId] = { quantity: 0, price: ii.price, name: ii.productName, code: ii.productCode };
      }
      invoiceItemsMap[ii.productId].quantity += ii.quantity;
    }

    const errors = [];
    const validItems = [];

    for (const ri of items) {
      const productId = ri.productId;
      const requestedQty = parseInt(ri.quantity);

      if (!requestedQty || requestedQty <= 0) {
        errors.push(`كمية إرجاع غير صالحة للمنتج ${ri.productId}`);
        continue;
      }

      const invoiceItem = invoiceItemsMap[productId];
      if (!invoiceItem) {
        errors.push(`المنتج ${productId} غير موجود في هذه الفاتورة`);
        continue;
      }

      const alreadyReturned = returnedMap.get(productId) || 0;
      const maxReturnable = invoiceItem.quantity - alreadyReturned;

      if (requestedQty > maxReturnable) {
        errors.push(
          `${invoiceItem.name}: الكمية المطلوبة (${requestedQty}) تتجاوز المتاح للإرجاع (${maxReturnable}). ` +
          `مشتراة: ${invoiceItem.quantity}، مُرجعة سابقاً: ${alreadyReturned}`
        );
        continue;
      }

      validItems.push({
        productId,
        quantity: requestedQty,
        price: invoiceItem.price,
        total: invoiceItem.price * requestedQty,
      });
    }

    if (errors.length > 0 || validItems.length === 0) {
      return res.status(400).json({ message: 'خطأ في الإرجاع', errors });
    }

    const totalAmount = validItems.reduce((sum, i) => sum + i.total, 0);

    const result = await prisma.$transaction(async (tx) => {
      // Generate unique return number
      let returnNumber;
      let retries = 0;
      do {
        returnNumber = generateRetailReturnNumber();
        const existing = await tx.retailReturn.findUnique({ where: { returnNumber } });
        if (!existing) break;
        retries++;
      } while (retries < 5);

      const returnRecord = await tx.retailReturn.create({
        data: {
          returnNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId || null,
          totalAmount,
          notes: notes || null,
          items: {
            create: validItems,
          },
        },
        include: { items: { include: { product: true } } },
      });

      // Restore stock
      await restoreReturnedStock(validItems, tx);

      return returnRecord;
    }, { timeout: 30000 });

    logger.info(`Retail return created: ${result.returnNumber}`, {
      category: 'retail_return',
      action: 'CREATE',
      returnNumber: result.returnNumber,
      invoiceId: invoice.id,
      totalAmount,
    });

    // Audit log
    logAudit({
      action: 'RETAIL_RETURN_CREATE',
      entity: 'retail_return',
      entityId: result.id,
      adminId: req.adminId,
      ip: req.ip,
      details: { returnNumber: result.returnNumber, invoiceNumber: invoice.invoiceNumber, itemCount: validItems.length },
    });

    res.status(201).json({
      message: 'تم الإرجاع بنجاح',
      return: result,
    });
  } catch (error) {
    logger.error('CreateRetailReturn error:', error);
    res.status(500).json({ message: error.message || 'خطأ في إنشاء الإرجاع' });
  }
};

// GET /api/retail-returns — list all retail returns
exports.getAllRetailReturns = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { returnNumber: { contains: search } },
        { invoice: { invoiceNumber: { contains: search } } },
        { customer: { name: { contains: search } } },
      ];
    }

    const [returns, total] = await Promise.all([
      prisma.retailReturn.findMany({
        where,
        include: {
          customer: { select: { id: true, customerCode: true, name: true, phone: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          items: { include: { product: { select: { code: true, name: true } } } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.retailReturn.count({ where }),
    ]);

    res.json({
      returns,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('GetAllRetailReturns error:', error);
    res.status(500).json({ message: 'خطأ في جلب المرتجعات' });
  }
};

// GET /api/retail-returns/invoice/:invoiceId/returned — returned quantities for invoice
exports.getInvoiceReturnedQuantities = async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    const returnedMap = await getRetailReturnedQuantities(invoiceId);

    const returned = {};
    returnedMap.forEach((qty, productId) => {
      returned[productId] = qty;
    });

    const returns = await prisma.retailReturn.findMany({
      where: { invoiceId },
      include: {
        items: { include: { product: { select: { code: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ returned, returns });
  } catch (error) {
    logger.error('GetInvoiceReturnedQuantities error:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات الإرجاع' });
  }
};
