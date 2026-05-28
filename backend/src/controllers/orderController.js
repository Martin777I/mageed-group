/**
 * MAGED GROUP — Order Controller
 * Order management with inventory transactions.
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { generateInvoicePdf } = require('../utils/pdfGenerator');
const { deductStock, restoreStock, recalculateStock } = require('../utils/inventoryService');
const { findOrCreateCustomer } = require('../utils/customerService');
const { logAudit } = require('../utils/auditService');

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const r = Math.floor(1000 + Math.random() * 9000);
  return `MG-${y}${m}${d}-${r}`;
}

exports.createOrder = async (req, res) => {
  try {
    const { customerName, customerPhone, items } = req.body;

    if (!customerName || !customerPhone || !items || !items.length) {
      return res.status(400).json({ message: 'الاسم ورقم الهاتف والمنتجات مطلوبة' });
    }

    const phoneRegex = /^[0-9+\-\s()]{8,20}$/;
    if (!phoneRegex.test(customerPhone)) {
      return res.status(400).json({ message: 'رقم الهاتف غير صالح' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find or create customer
      const customer = await findOrCreateCustomer({
        name: customerName,
        phone: customerPhone,
      }, tx);

      const orderItems = [];
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { code: item.code } });
        if (!product || !product.isActive) {
          throw new Error(`المنتج غير موجود: ${item.code}`);
        }
        orderItems.push({
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          price: product.price,
          quantity: parseInt(item.quantity) || 1,
          total: product.price * (parseInt(item.quantity) || 1),
        });
      }

      const totalAmount = orderItems.reduce((sum, i) => sum + i.total, 0);

      // Generate unique order number with retry
      let orderNumber;
      let retries = 0;
      do {
        orderNumber = generateOrderNumber();
        const existing = await tx.order.findUnique({ where: { orderNumber } });
        if (!existing) break;
        retries++;
      } while (retries < 5);

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerName,
          customerPhone,
          totalAmount,
          items: { create: orderItems },
        },
        include: { items: true },
      });

      return order;
    }, { timeout: 15000 });

    logger.info(`Order created: ${result.orderNumber}`, {
      category: 'order',
      action: 'CREATE',
      orderNumber: result.orderNumber,
      customerId: result.customerId,
      totalAmount: result.totalAmount,
    });

    res.status(201).json({ orderNumber: result.orderNumber, message: 'تم إرسال الطلب بنجاح' });
  } catch (error) {
    logger.error('CreateOrder error:', error);
    res.status(error.message.includes('المنتج غير موجود') ? 400 : 500).json({
      message: error.message || 'خطأ في إنشاء الطلب',
    });
  }
};

exports.getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalProducts,
      pendingOrders,
      todayOrders,
      acceptedOrders,
      totalCompanies,
      totalCustomers,
      totalReturnsData,
      lowStockProducts,
      outOfStockProducts,
      monthlySales,
      monthlyReturns,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.count({ where: { status: 'accepted', createdAt: { gte: today } } }),
      prisma.order.findMany({
        where: { status: 'accepted', createdAt: { gte: today } },
        select: { totalAmount: true },
      }),
      prisma.company.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.return.aggregate({ _sum: { totalAmount: true }, _count: true }),
      prisma.product.count({ where: { isActive: true, stock: { gt: 0, lte: 5 } } }),
      prisma.product.count({ where: { isActive: true, stock: 0 } }),
      // Monthly sales (last 30 days)
      prisma.order.aggregate({
        where: { status: 'accepted', createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Monthly returns
      prisma.return.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    const todayRevenue = acceptedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Top customers
    const topCustomers = await prisma.order.groupBy({
      by: ['customerId'],
      where: { status: 'accepted', customerId: { not: null } },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });

    const topCustIds = topCustomers.map((c) => c.customerId).filter(Boolean);
    const topCustData = topCustIds.length > 0 ? await prisma.customer.findMany({
      where: { id: { in: topCustIds } },
      select: { id: true, customerCode: true, name: true, phone: true },
    }) : [];
    const custMap = {};
    topCustData.forEach((c) => { custMap[c.id] = c; });

    const topCustomersResult = topCustomers.map((c) => ({
      customer: custMap[c.customerId] || null,
      totalAmount: c._sum.totalAmount,
      ordersCount: c._count,
    }));

    // Top selling products
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: 'accepted' } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    });

    const topProdIds = topProducts.map((p) => p.productId);
    const topProdData = topProdIds.length > 0 ? await prisma.product.findMany({
      where: { id: { in: topProdIds } },
      select: { id: true, code: true, name: true },
    }) : [];
    const prodMap = {};
    topProdData.forEach((p) => { prodMap[p.id] = p; });

    const topProductsResult = topProducts.map((p) => ({
      product: prodMap[p.productId] || null,
      totalQuantity: p._sum.quantity,
      totalAmount: p._sum.total,
    }));

    // Top companies — aggregate by product.companyId using groupBy
    const companyGroups = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: 'accepted' } },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 50, // Limit to top 50 products for aggregation
    });

    const companyProdIds = companyGroups.map((g) => g.productId);
    const companyProducts = companyProdIds.length > 0 ? await prisma.product.findMany({
      where: { id: { in: companyProdIds } },
      select: { id: true, company: { select: { id: true, name: true, color: true } } },
    }) : [];
    const companyProdMap = {};
    companyProducts.forEach((p) => { companyProdMap[p.id] = p; });

    const companyAgg = {};
    for (const group of companyGroups) {
      const prod = companyProdMap[group.productId];
      const companyName = prod?.company?.name || 'بدون شركة';
      if (!companyAgg[companyName]) {
        companyAgg[companyName] = { name: companyName, color: prod?.company?.color || '#6b7280', total: 0, quantity: 0 };
      }
      companyAgg[companyName].total += group._sum.total || 0;
      companyAgg[companyName].quantity += group._sum.quantity || 0;
    }
    const topCompaniesResult = Object.values(companyAgg).sort((a, b) => b.total - a.total).slice(0, 5);

    // Low stock products
    const lowStockList = await prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0, lte: 5 } },
      select: { id: true, code: true, name: true, stock: true },
      orderBy: { stock: 'asc' },
      take: 10,
    });

    // Out of stock products
    const outOfStockList = await prisma.product.findMany({
      where: { isActive: true, stock: 0 },
      select: { id: true, code: true, name: true },
      take: 10,
    });

    res.json({
      totalProducts,
      pendingOrders,
      todayOrders,
      todayRevenue,
      totalCompanies,
      totalCustomers,
      totalReturns: totalReturnsData._count,
      totalReturnsAmount: totalReturnsData._sum.totalAmount || 0,
      lowStockProducts,
      outOfStockProducts,
      lowStockList,
      outOfStockList,
      monthlySales: {
        count: monthlySales._count,
        amount: monthlySales._sum.totalAmount || 0,
      },
      monthlyReturns: {
        count: monthlyReturns._count,
        amount: monthlyReturns._sum.totalAmount || 0,
      },
      topCustomers: topCustomersResult,
      topProducts: topProductsResult,
      topCompanies: topCompaniesResult,
    });
  } catch (error) {
    logger.error('GetStats error:', error);
    res.status(500).json({ message: 'خطأ في جلب الإحصائيات' });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status && status !== 'all' ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: { select: { id: true, customerCode: true, name: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('GetAllOrders error:', error);
    res.status(500).json({ message: 'خطأ في جلب الطلبات' });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
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
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }
    res.json(order);
  } catch (error) {
    logger.error('GetOrderById error:', error);
    res.status(500).json({ message: 'خطأ في جلب الطلب' });
  }
};

// GET /api/orders/:id/analytics
exports.getOrderAnalytics = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        items: {
          include: {
            product: {
              include: {
                company: { select: { id: true, name: true, color: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    const companyMap = {};
    for (const item of order.items) {
      const companyName = item.product?.company?.name || 'بدون شركة';
      const companyColor = item.product?.company?.color || '#6b7280';
      const companyId = item.product?.company?.id || 0;

      if (!companyMap[companyName]) {
        companyMap[companyName] = { companyId, companyName, companyColor, itemCount: 0, totalQuantity: 0, totalPrice: 0 };
      }
      companyMap[companyName].itemCount++;
      companyMap[companyName].totalQuantity += item.quantity;
      companyMap[companyName].totalPrice += item.total;
    }

    const analytics = Object.values(companyMap);
    const grandTotal = analytics.reduce((sum, a) => sum + a.totalPrice, 0);

    for (const entry of analytics) {
      entry.percentage = grandTotal > 0 ? Math.round((entry.totalPrice / grandTotal) * 100 * 10) / 10 : 0;
    }
    analytics.sort((a, b) => b.totalPrice - a.totalPrice);

    res.json({ orderNumber: order.orderNumber, totalAmount: order.totalAmount, analytics });
  } catch (error) {
    logger.error('GetOrderAnalytics error:', error);
    res.status(500).json({ message: 'خطأ في جلب تحليلات الطلب' });
  }
};

// PUT /api/orders/:id/status — WITH INVENTORY DEDUCTION
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'الحالة غير صالحة' });
    }

    const orderId = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!currentOrder) throw new Error('الطلب غير موجود');

      if (status === 'accepted') {
        // SAFETY: Block double-deduction — only accept from pending
        if (currentOrder.status !== 'pending') {
          throw new Error('لا يمكن قبول طلب غير معلق — الحالة الحالية: ' + currentOrder.status);
        }

        // Deduct stock
        await deductStock(orderId, tx);

        return await tx.order.update({
          where: { id: orderId },
          data: { status, acceptedAt: new Date(), ...(notes !== undefined && { notes }) },
          include: { items: true },
        });
      } else if (status === 'rejected') {
        // If was previously accepted, restore stock
        if (currentOrder.status === 'accepted' && currentOrder.stockDeducted) {
          await restoreStock(orderId, tx);
        }

        return await tx.order.update({
          where: { id: orderId },
          data: { status, ...(notes !== undefined && { notes }) },
          include: { items: true },
        });
      }
    }, { timeout: 15000 });

    logger.info(`Order ${result.orderNumber} status changed to ${status}`, {
      category: 'order',
      action: 'STATUS_CHANGE',
      orderId,
      status,
      adminId: req.adminId,
    });

    // Audit log (non-blocking)
    logAudit({
      action: `ORDER_${status.toUpperCase()}`,
      entity: 'order',
      entityId: orderId,
      adminId: req.adminId,
      ip: req.ip,
      details: { orderNumber: result.orderNumber, status },
    });

    res.json(result);
  } catch (error) {
    if (error.message.includes('المخزون غير كافٍ')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }
    logger.error('UpdateOrderStatus error:', error);
    res.status(500).json({ message: error.message || 'خطأ في تحديث حالة الطلب' });
  }
};

exports.updateOrderItems = async (req, res) => {
  try {
    const { items } = req.body;
    const orderId = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new Error('الطلب غير موجود');
      if (order.status !== 'pending') {
        throw new Error('لا يمكن تعديل طلب تم قبوله أو رفضه');
      }

      const oldItems = [...order.items];
      await tx.orderItem.deleteMany({ where: { orderId } });

      const newItems = [];
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { code: item.productCode } });
        if (!product) throw new Error(`المنتج غير موجود: ${item.productCode}`);
        newItems.push({
          orderId,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          price: product.price,
          quantity: parseInt(item.quantity) || 1,
          total: product.price * (parseInt(item.quantity) || 1),
        });
      }

      await tx.orderItem.createMany({ data: newItems });

      // If stock was deducted, recalculate
      if (order.stockDeducted) {
        await recalculateStock(orderId, oldItems, newItems, tx);
      }

      const totalAmount = newItems.reduce((sum, i) => sum + i.total, 0);
      return await tx.order.update({
        where: { id: orderId },
        data: { totalAmount },
        include: { items: { include: { product: true } } },
      });
    }, { timeout: 15000 });

    // Audit log (non-blocking)
    logAudit({
      action: 'ORDER_ITEMS_EDIT',
      entity: 'order',
      entityId: orderId,
      adminId: req.adminId,
      ip: req.ip,
      details: { itemCount: items.length },
    });

    res.json(result);
  } catch (error) {
    logger.error('UpdateOrderItems error:', error);
    res.status(error.message.includes('المنتج غير موجود') || error.message.includes('لا يمكن') ? 400 : 500).json({
      message: error.message || 'خطأ في تحديث عناصر الطلب',
    });
  }
};

exports.generatePdf = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { items: true },
    });
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);

    await generateInvoicePdf(order, res);
  } catch (error) {
    logger.error('GeneratePdf error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'خطأ في إنشاء الفاتورة' });
    }
  }
};
