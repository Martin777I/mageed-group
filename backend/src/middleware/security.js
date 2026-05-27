/**
 * MAGED GROUP — Production Security Middleware
 * Helmet, rate limiting, compression, CORS, request size limits.
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cors = require('cors');
const config = require('../config/config');

/**
 * Configure CORS with strict origin allowlist
 */
function setupCors() {
  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (config.cors.origins.includes(origin)) {
        return callback(null, true);
      }

      // In development, be more permissive
      if (config.isDev) {
        return callback(null, true);
      }

      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 hours preflight cache
  });
}

/**
 * Configure Helmet for security headers
 */
function setupHelmet() {
  return helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin image loading
    contentSecurityPolicy: config.isProd ? undefined : false, // Disable CSP in dev
  });
}

/**
 * General rate limiter (100 req / 15 min)
 */
function setupRateLimit() {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      success: false,
      message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health';
    },
  });
}

/**
 * Strict rate limiter for login (10 req / 15 min)
 */
function setupLoginRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.rateLimit.loginMax,
    message: {
      success: false,
      message: 'محاولات تسجيل دخول كثيرة. يرجى الانتظار 15 دقيقة.',
      code: 'LOGIN_RATE_LIMIT',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Configure compression
 */
function setupCompression() {
  return compression({
    level: 6,
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  });
}

module.exports = {
  setupCors,
  setupHelmet,
  setupRateLimit,
  setupLoginRateLimit,
  setupCompression,
};
