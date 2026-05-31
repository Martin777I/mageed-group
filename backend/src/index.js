/**
 * MAGED GROUP — Production Backend Server
 * 
 * Express application with:
 * - Security middleware (helmet, CORS, rate limiting, compression)
 * - Structured logging (Winston)
 * - Centralized error handling
 * - Health monitoring endpoints
 * - Graceful shutdown
 */

const config = require('./config/config');
const logger = require('./config/logger');
const express = require('express');
const path = require('path');

// ── Security middleware ──
const {
  setupCors,
  setupHelmet,
  setupRateLimit,
  setupLoginRateLimit,
  setupCompression,
} = require('./middleware/security');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

// ── Routes ──
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const companyRoutes = require('./routes/companies');
const customerRoutes = require('./routes/customers');
const returnRoutes = require('./routes/returns');
const retailRoutes = require('./routes/retail');
const retailReturnRoutes = require('./routes/retailReturns');
const healthRoutes = require('./routes/health');
const alertRoutes = require('./routes/alerts');

const app = express();

// ══════════════════════════════════════════════
//  MIDDLEWARE STACK
// ══════════════════════════════════════════════

// 1. Security headers
app.use(setupHelmet());

// 2. CORS
app.use(setupCors());

// 3. Compression
app.use(setupCompression());

// 4. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Request logging
app.use(requestLogger);

// 6. General rate limiting
if (config.isProd) {
  app.use(setupRateLimit());
}

// 7. Static files for uploads (backward compatibility during migration)
//    In production, images should come from Cloudinary, but keep this
//    so existing local logo URLs don't break during transition.
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ══════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════

// Health & monitoring (some public, some auth)
app.use('/api/health', healthRoutes);
app.use('/api/alerts', alertRoutes);

// Auth (with login rate limiting)
const loginLimiter = setupLoginRateLimit();
app.post('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);

// API routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/retail', retailRoutes);
app.use('/api/retail-returns', retailReturnRoutes);

// ══════════════════════════════════════════════
//  ERROR HANDLING
// ══════════════════════════════════════════════

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'المسار المطلوب غير موجود',
    code: 'NOT_FOUND',
    path: req.originalUrl,
  });
});

// Centralized error handler (must be last)
app.use(errorHandler);

// ══════════════════════════════════════════════
//  SERVER STARTUP
// ══════════════════════════════════════════════

const server = app.listen(config.port, () => {
  logger.info('═══════════════════════════════════════════');
  logger.info('  MAGED GROUP — Server Started');
  logger.info('═══════════════════════════════════════════');
  logger.info(`  Environment : ${config.env}`);
  logger.info(`  Port        : ${config.port}`);
  logger.info(`  Frontend    : ${config.frontendUrl}`);
  logger.info(`  Cloudinary  : ${config.cloudinary.isConfigured ? 'Configured ✅' : 'Not configured ⚠️'}`);
  logger.info(`  CORS Origins: ${config.cors.origins.join(', ') || 'All (dev mode)'}`);
  logger.info('═══════════════════════════════════════════');
});

// ══════════════════════════════════════════════
//  GRACEFUL SHUTDOWN
// ══════════════════════════════════════════════

function gracefulShutdown(signal) {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      const { disconnectPrisma } = require('./config/prisma');
      await disconnectPrisma();
    } catch (err) {
      logger.error('Error during shutdown:', err);
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Process error handlers ──
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

module.exports = app;
