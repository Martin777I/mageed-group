/**
 * MAGEED GROUP — HTTP Request Logger Middleware
 * Logs all incoming requests with method, URL, status, response time.
 */

const logger = require('../config/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message, {
        category: 'http',
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip,
      });
    } else if (res.statusCode >= 400) {
      logger.warn(message, {
        category: 'http',
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
      });
    } else {
      logger.info(message, { category: 'http' });
    }
  });

  next();
}

module.exports = requestLogger;
