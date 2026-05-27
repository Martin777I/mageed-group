/**
 * MAGED GROUP — Customer Controller
 * Customer CRUD + search + statistics.
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { getCustomerStats } = require('../utils/customerService');

// GET /api/customers
exports.getAllCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { customerCode: { contains: search } },
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: { select: { orders: true, returns: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      customers,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('GetAllCustomers error:', error);
    res.status(500).json({ message: 'خطأ في جلب العملاء' });
  }
};

// GET /api/customers/:id
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!customer) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }

    const stats = await getCustomerStats(customer.id);

    res.json({ ...customer, stats });
  } catch (error) {
    logger.error('GetCustomerById error:', error);
    res.status(500).json({ message: 'خطأ في جلب العميل' });
  }
};

// GET /api/customers/:id/orders
exports.getCustomerOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const customerId = parseInt(req.params.id);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId },
        include: { items: true, returns: { include: { items: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where: { customerId } }),
    ]);

    res.json({
      orders,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('GetCustomerOrders error:', error);
    res.status(500).json({ message: 'خطأ في جلب طلبات العميل' });
  }
};

// GET /api/customers/:id/returns
exports.getCustomerReturns = async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);

    const returns = await prisma.return.findMany({
      where: { customerId },
      include: {
        order: { select: { orderNumber: true } },
        items: { include: { product: { select: { code: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(returns);
  } catch (error) {
    logger.error('GetCustomerReturns error:', error);
    res.status(500).json({ message: 'خطأ في جلب المرتجعات' });
  }
};

// PUT /api/customers/:id
exports.updateCustomer = async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (phone !== undefined) data.phone = phone.trim();
    if (address !== undefined) data.address = address || null;
    if (notes !== undefined) data.notes = notes || null;

    const customer = await prisma.customer.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json(customer);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'العميل غير موجود' });
    if (error.code === 'P2002') return res.status(409).json({ message: 'رقم الهاتف مسجل لعميل آخر' });
    logger.error('UpdateCustomer error:', error);
    res.status(500).json({ message: 'خطأ في تحديث العميل' });
  }
};

// GET /api/customers/search/phone/:phone
exports.searchByPhone = async (req, res) => {
  try {
    const phone = req.params.phone.trim();
    const customer = await prisma.customer.findUnique({
      where: { phone },
      include: {
        orders: {
          where: { status: 'accepted' },
          include: { items: true, returns: { include: { items: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { orders: true, returns: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }

    res.json(customer);
  } catch (error) {
    logger.error('SearchByPhone error:', error);
    res.status(500).json({ message: 'خطأ في البحث' });
  }
};

// GET /api/customers/search/code/:code
exports.searchByCode = async (req, res) => {
  try {
    const code = req.params.code.trim();
    const customer = await prisma.customer.findUnique({
      where: { customerCode: code },
      include: {
        orders: {
          where: { status: 'accepted' },
          include: { items: true, returns: { include: { items: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { orders: true, returns: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }

    res.json(customer);
  } catch (error) {
    logger.error('SearchByCode error:', error);
    res.status(500).json({ message: 'خطأ في البحث' });
  }
};
