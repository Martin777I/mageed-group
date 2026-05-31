/**
 * MAGED GROUP — Retail Controller (القطاعي)
 * Retail invoice management with immediate stock deduction.
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { checkStockAvailability } = require('../utils/inventoryService');
const { logAudit } = require('../utils/auditService');

/**
 * Generate a simple sequential invoice number: RT-0001, RT-0002, ...
 */
async function generateInvoiceNumber(tx) {
  const last = await tx.retailInvoice.findFirst({
    orderBy: { id: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextNum = 1;
  if (last && last.invoiceNumber) {
    const match = last.invoiceNumber.match(/RT-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return `RT-${String(nextNum).padStart(4, '0')}`;
}

// POST /api/retail — create retail invoice (immediate stock deduction)
exports.createRetailInvoice = async (req, res) => {
  try {
    const { customerName, customerPhone, customerId, items, notes } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: 'المنتجات مطلوبة' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Build invoice items from product codes
      const invoiceItems = [];
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { code: item.code } });
        if (!product || !product.isActive) {
          throw new Error(`المنتج غير موجود: ${item.code}`);
        }

        const qty = parseInt(item.quantity) || 1;

        // Check stock availability
        if (product.stock < qty) {
          throw new Error(`المخزون غير كافٍ لـ ${product.name}: مطلوب ${qty}، متوفر ${product.stock}`);
        }

        invoiceItems.push({
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          price: product.price,
          quantity: qty,
          total: product.price * qty,
        });
      }

      const totalAmount = invoiceItems.reduce((sum, i) => sum + i.total, 0);

      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber(tx);

      // Resolve customer if provided
      let resolvedCustomerId = null;
      if (customerId) {
        const customer = await tx.customer.findUnique({ where: { id: parseInt(customerId) } });
        if (customer) resolvedCustomerId = customer.id;
      }

      // Create invoice
      const invoice = await tx.retailInvoice.create({
        data: {
          invoiceNumber,
          customerId: resolvedCustomerId,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          totalAmount,
          notes: notes || null,
          adminId: req.adminId || null,
          items: { create: invoiceItems },
        },
        include: { items: true },
      });

      // Deduct stock immediately
      for (const item of invoiceItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return invoice;
    }, { timeout: 15000 });

    logger.info(`Retail invoice created: ${result.invoiceNumber}`, {
      category: 'retail',
      action: 'CREATE',
      invoiceNumber: result.invoiceNumber,
      totalAmount: result.totalAmount,
    });

    // Audit log
    logAudit({
      action: 'RETAIL_INVOICE_CREATE',
      entity: 'retail_invoice',
      entityId: result.id,
      adminId: req.adminId,
      ip: req.ip,
      details: { invoiceNumber: result.invoiceNumber, itemCount: items.length, totalAmount: result.totalAmount },
    });

    res.status(201).json({
      invoice: result,
      message: 'تم إنشاء الفاتورة بنجاح',
    });
  } catch (error) {
    logger.error('CreateRetailInvoice error:', error);
    const statusCode = error.message.includes('المنتج غير موجود') || error.message.includes('المخزون غير كافٍ') ? 400 : 500;
    res.status(statusCode).json({ message: error.message || 'خطأ في إنشاء الفاتورة' });
  }
};

// GET /api/retail — list all retail invoices
exports.getAllRetailInvoices = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.retailInvoice.findMany({
        where,
        include: {
          customer: { select: { id: true, customerCode: true, name: true, phone: true } },
          items: { include: { product: { select: { code: true, name: true } } } },
          _count: { select: { returns: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.retailInvoice.count({ where }),
    ]);

    res.json({
      invoices,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('GetAllRetailInvoices error:', error);
    res.status(500).json({ message: 'خطأ في جلب الفواتير' });
  }
};

// GET /api/retail/stats — retail statistics
exports.getRetailStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalInvoices,
      todayInvoices,
      todayInvoicesList,
      monthlyData,
      totalReturnsData,
      monthlyReturns,
    ] = await Promise.all([
      prisma.retailInvoice.count(),
      prisma.retailInvoice.count({ where: { createdAt: { gte: today } } }),
      prisma.retailInvoice.findMany({
        where: { createdAt: { gte: today } },
        select: { totalAmount: true },
      }),
      prisma.retailInvoice.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.retailReturn.aggregate({ _sum: { totalAmount: true }, _count: true }),
      prisma.retailReturn.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    const todayRevenue = todayInvoicesList.reduce((sum, i) => sum + i.totalAmount, 0);

    res.json({
      totalInvoices,
      todayInvoices,
      todayRevenue,
      totalReturns: totalReturnsData._count,
      totalReturnsAmount: totalReturnsData._sum.totalAmount || 0,
      monthlySales: {
        count: monthlyData._count,
        amount: monthlyData._sum.totalAmount || 0,
      },
      monthlyReturns: {
        count: monthlyReturns._count,
        amount: monthlyReturns._sum.totalAmount || 0,
      },
    });
  } catch (error) {
    logger.error('GetRetailStats error:', error);
    res.status(500).json({ message: 'خطأ في جلب إحصائيات القطاعي' });
  }
};

// GET /api/retail/:id — single retail invoice
exports.getRetailInvoiceById = async (req, res) => {
  try {
    const invoice = await prisma.retailInvoice.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                company: { select: { id: true, name: true, color: true, logo: true } },
              },
            },
          },
        },
        returns: {
          include: { items: { include: { product: { select: { code: true, name: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    res.json(invoice);
  } catch (error) {
    logger.error('GetRetailInvoiceById error:', error);
    res.status(500).json({ message: 'خطأ في جلب الفاتورة' });
  }
};

// GET /api/retail/search/:invoiceNumber — search by invoice number
exports.searchByInvoiceNumber = async (req, res) => {
  try {
    const invoice = await prisma.retailInvoice.findUnique({
      where: { invoiceNumber: req.params.invoiceNumber },
      include: {
        customer: { select: { id: true, customerCode: true, name: true, phone: true } },
        items: { include: { product: { select: { code: true, name: true } } } },
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    }

    res.json(invoice);
  } catch (error) {
    logger.error('SearchByInvoiceNumber error:', error);
    res.status(500).json({ message: 'خطأ في البحث عن الفاتورة' });
  }
};
