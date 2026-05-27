/**
 * MAGEED GROUP — Health & Monitoring Controller
 * System health checks, alerts, and monitoring endpoints.
 */

const prisma = require('../config/prisma');
const { testConnection: testDb } = require('../config/prisma');
const cloudinary = require('../services/cloudinaryService');
const logger = require('../config/logger');
const os = require('os');

// GET /api/health — Basic health check (public)
exports.healthCheck = async (req, res) => {
  try {
    const dbCheck = await testDb();

    res.json({
      success: true,
      status: dbCheck.connected ? 'healthy' : 'degraded',
      message: 'MAGEED GROUP API is running',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: dbCheck.connected ? 'connected' : 'disconnected',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'خطأ في فحص صحة النظام',
      timestamp: new Date().toISOString(),
    });
  }
};

// GET /api/health/detailed — Full system status (auth required)
exports.detailedHealth = async (req, res) => {
  try {
    const startTime = Date.now();

    // Database check with latency
    const dbStart = Date.now();
    const dbCheck = await testDb();
    const dbLatency = Date.now() - dbStart;

    // Cloudinary check
    const cloudinaryCheck = await cloudinary.testConnection();

    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // Database counts
    let dbCounts = {};
    try {
      const [products, orders, customers, companies, returns] = await Promise.all([
        prisma.product.count(),
        prisma.order.count(),
        prisma.customer.count(),
        prisma.company.count(),
        prisma.return.count(),
      ]);
      dbCounts = { products, orders, customers, companies, returns };
    } catch {
      dbCounts = { error: 'Failed to fetch counts' };
    }

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      status: dbCheck.connected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: formatUptime(process.uptime()),
      },
      database: {
        connected: dbCheck.connected,
        latency: `${dbLatency}ms`,
        error: dbCheck.error || null,
      },
      cloudinary: {
        configured: cloudinaryCheck.connected || false,
        error: cloudinaryCheck.error || null,
      },
      memory: {
        rss: formatBytes(memUsage.rss),
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        external: formatBytes(memUsage.external),
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        totalMemory: formatBytes(totalMem),
        freeMemory: formatBytes(freeMem),
        cpuCores: os.cpus().length,
      },
      records: dbCounts,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'خطأ في فحص صحة النظام التفصيلي',
    });
  }
};

// GET /api/health/db — Database check (auth required)
exports.dbCheck = async (req, res) => {
  try {
    const start = Date.now();
    const result = await testDb();
    const latency = Date.now() - start;

    if (result.connected) {
      res.json({
        success: true,
        connected: true,
        latency: `${latency}ms`,
      });
    } else {
      res.status(503).json({
        success: false,
        connected: false,
        error: result.error,
        latency: `${latency}ms`,
      });
    }
  } catch (error) {
    logger.error('DB health check error:', error);
    res.status(503).json({
      success: false,
      connected: false,
      error: error.message,
    });
  }
};

// GET /api/alerts/low-stock — Low stock products alert (auth required)
exports.lowStockAlert = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;

    const [lowStock, outOfStock] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, stock: { gt: 0, lte: threshold } },
        select: { id: true, code: true, name: true, stock: true, category: true },
        orderBy: { stock: 'asc' },
      }),
      prisma.product.findMany({
        where: { isActive: true, stock: 0 },
        select: { id: true, code: true, name: true, category: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      success: true,
      threshold,
      lowStock: {
        count: lowStock.length,
        products: lowStock,
      },
      outOfStock: {
        count: outOfStock.length,
        products: outOfStock,
      },
      totalAlerts: lowStock.length + outOfStock.length,
    });
  } catch (error) {
    logger.error('Low stock alert error:', error);
    res.status(500).json({ message: 'خطأ في جلب تنبيهات المخزون' });
  }
};

// GET /api/alerts/summary — Quick summary for dashboard alerts (auth required)
exports.alertsSummary = async (req, res) => {
  try {
    const [pendingOrders, lowStock, outOfStock] = await Promise.all([
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.product.count({ where: { isActive: true, stock: { gt: 0, lte: 5 } } }),
      prisma.product.count({ where: { isActive: true, stock: 0 } }),
    ]);

    res.json({
      success: true,
      alerts: [
        ...(pendingOrders > 0 ? [{
          type: 'warning',
          category: 'orders',
          message: `${pendingOrders} طلب بانتظار المراجعة`,
          count: pendingOrders,
        }] : []),
        ...(outOfStock > 0 ? [{
          type: 'danger',
          category: 'stock',
          message: `${outOfStock} منتج نفد من المخزون`,
          count: outOfStock,
        }] : []),
        ...(lowStock > 0 ? [{
          type: 'warning',
          category: 'stock',
          message: `${lowStock} منتج مخزونه منخفض`,
          count: lowStock,
        }] : []),
      ],
      totalAlerts: (pendingOrders > 0 ? 1 : 0) + (outOfStock > 0 ? 1 : 0) + (lowStock > 0 ? 1 : 0),
    });
  } catch (error) {
    logger.error('Alerts summary error:', error);
    res.status(500).json({ message: 'خطأ في جلب ملخص التنبيهات' });
  }
};

// ── Helpers ──

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
