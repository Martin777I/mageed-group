/**
 * MAGEED GROUP — Production Logging System
 * Winston-based structured logging with file rotation.
 */

const winston = require('winston');
const path = require('path');
const config = require('./config');

// ── Log directory ──
const LOG_DIR = path.resolve(__dirname, '../../', config.log.dir);

// ── Custom format ──
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}${metaStr}`;
    }
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── Create logger ──
const logger = winston.createLogger({
  level: config.log.level,
  defaultMeta: { service: 'mageed-group' },
  transports: [],
});

if (config.isProd) {
  // Production: JSON to files
  logger.add(new winston.transports.File({
    filename: path.join(LOG_DIR, 'error.log'),
    level: 'error',
    format: jsonFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }));

  logger.add(new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    format: jsonFormat,
    maxsize: 10 * 1024 * 1024,
    maxFiles: 10,
  }));

  // Minimal console output in production
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message }) =>
        `${timestamp} [${level.toUpperCase()}] ${message}`
      )
    ),
  }));
} else {
  // Development: colorized console
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        if (stack) return `${timestamp} ${level}: ${message}\n${stack}`;
        return `${timestamp} ${level}: ${message}`;
      })
    ),
  }));
}

// ── Specialized loggers ──

/**
 * Log an import operation
 */
logger.logImport = (data) => {
  logger.info('📥 Import operation', { category: 'import', ...data });
};

/**
 * Log an inventory change
 */
logger.logInventory = (data) => {
  logger.info('📦 Inventory change', { category: 'inventory', ...data });
};

/**
 * Log a return operation
 */
logger.logReturn = (data) => {
  logger.info('🔄 Return operation', { category: 'return', ...data });
};

/**
 * Log an authentication event
 */
logger.logAuth = (data) => {
  logger.info('🔐 Auth event', { category: 'auth', ...data });
};

module.exports = logger;
