/**
 * MAGED GROUP — Return Controller
 * Returns management with stock restoration.
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { processReturn, getReturnedQuantities } = require('../utils/returnService');
const { logAudit } = require('../utils/auditService');

// POST /api/returns — create a return
exports.createReturn = async (req, res) => {
  try {
    const { customerId, orderId, items, notes } = req.body;

    if (!customerId || !orderId || !items || !items.length) {
      return res.status(400).json({ message: 'بيانات الإرجاع غير مكتملة' });
    }

    const result = await processReturn({ customerId, orderId, items, notes });

    if (!result.success) {
      return res.status(400).json({ message: 'خطأ في الإرجاع', errors: result.errors });
    }

    res.status(201).json({
      message: 'تم الإرجاع بنجاح',
      return: result.return,
    });

    // Audit log (non-blocking)
    logAudit({
      action: 'CREATE',
      entity: 'return',
      entityId: result.return?.id,
      adminId: req.adminId,
      ip: req.ip,
      details: { returnNumber: result.return?.returnNumber, orderId, customerId, itemCount: items.length },
    });
  } catch (error) {
    logger.error('CreateReturn error:', error);
    res.status(500).json({ message: error.message || 'خطأ في إنشاء الإرجاع' });
  }
};

// GET /api/returns — list all returns
exports.getAllReturns = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { returnNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
        { customer: { customerCode: { contains: search } } },
      ];
    }

    const [returns, total] = await Promise.all([
      prisma.return.findMany({
        where,
        include: {
          customer: { select: { id: true, customerCode: true, name: true, phone: true } },
          order: { select: { id: true, orderNumber: true } },
          items: { include: { product: { select: { code: true, name: true } } } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.return.count({ where }),
    ]);

    res.json({
      returns,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('GetAllReturns error:', error);
    res.status(500).json({ message: 'خطأ في جلب المرتجعات' });
  }
};

// GET /api/returns/:id — single return
exports.getReturnById = async (req, res) => {
  try {
    const ret = await prisma.return.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        customer: true,
        order: { select: { id: true, orderNumber: true, totalAmount: true } },
        items: { include: { product: { select: { code: true, name: true } } } },
      },
    });
    if (!ret) {
      return res.status(404).json({ message: 'المرتجع غير موجود' });
    }
    res.json(ret);
  } catch (error) {
    logger.error('GetReturnById error:', error);
    res.status(500).json({ message: 'خطأ في جلب المرتجع' });
  }
};

// GET /api/returns/order/:orderId/returned — get returned quantities for an order
exports.getOrderReturnedQuantities = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const returnedMap = await getReturnedQuantities(orderId);

    // Convert map to object
    const returned = {};
    returnedMap.forEach((qty, productId) => {
      returned[productId] = qty;
    });

    // Also get all returns for this order
    const returns = await prisma.return.findMany({
      where: { orderId },
      include: {
        items: { include: { product: { select: { code: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ returned, returns });
  } catch (error) {
    logger.error('GetOrderReturnedQuantities error:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات الإرجاع' });
  }
};

// GET /api/returns/stats — return statistics
exports.getReturnStats = async (req, res) => {
  try {
    const [totalReturns, totalAmount, recentReturns] = await Promise.all([
      prisma.return.count(),
      prisma.return.aggregate({ _sum: { totalAmount: true } }),
      prisma.return.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true } },
          order: { select: { orderNumber: true } },
        },
      }),
    ]);

    // Most returned products
    const returnItems = await prisma.returnItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const productIds = returnItems.map((i) => i.productId);
    const products = productIds.length > 0 ? await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, code: true, name: true },
    }) : [];
    const productMap = {};
    products.forEach((p) => { productMap[p.id] = p; });

    const mostReturned = returnItems.map((i) => ({
      product: productMap[i.productId] || { code: '?', name: '?' },
      totalQuantity: i._sum.quantity,
      totalAmount: i._sum.total,
    }));

    // Total orders for return percentage
    const totalOrders = await prisma.order.count({ where: { status: 'accepted' } });
    const ordersWithReturns = await prisma.return.findMany({
      select: { orderId: true },
      distinct: ['orderId'],
    });
    const returnPercentage = totalOrders > 0
      ? Math.round((ordersWithReturns.length / totalOrders) * 100 * 10) / 10
      : 0;

    res.json({
      totalReturns,
      totalAmount: totalAmount._sum.totalAmount || 0,
      returnPercentage,
      mostReturned,
      recentReturns,
    });
  } catch (error) {
    logger.error('GetReturnStats error:', error);
    res.status(500).json({ message: 'خطأ في جلب إحصائيات المرتجعات' });
  }
};
