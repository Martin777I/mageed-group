/**
 * MAGEED GROUP — Centralized Configuration
 * Validates and exports all environment variables at startup.
 * Fails fast if required variables are missing in production.
 */

require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// ── Required variables (always needed) ──
const required = ['DATABASE_URL', 'JWT_SECRET'];

// ── Required in production only ──
const requiredInProd = ['FRONTEND_URL'];

function validateEnv() {
  const missing = [];

  for (const key of required) {
    if (!process.env[key]) missing.push(key);
  }

  if (isProd) {
    for (const key of requiredInProd) {
      if (!process.env[key]) missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables:\n   ${missing.join(', ')}\n`);
    console.error('   Create a .env file or set these variables in your deployment platform.\n');
    process.exit(1);
  }

  // Warn about insecure defaults
  if (process.env.JWT_SECRET === 'supersecretkey' || process.env.JWT_SECRET === 'change-this-to-a-long-random-secret-key') {
    if (isProd) {
      console.error('\n❌ JWT_SECRET is using an insecure default value. Change it for production!\n');
      process.exit(1);
    } else {
      console.warn('\n⚠️  JWT_SECRET is using an insecure default. Change it before deploying.\n');
    }
  }
}

validateEnv();

// ── Parse CORS origins ──
function parseCorsOrigins() {
  const originsStr = process.env.CORS_ORIGINS || '';
  if (!originsStr) {
    // Default origins
    if (isProd) {
      return process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
    }
    return ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
  }
  return originsStr.split(',').map((o) => o.trim()).filter(Boolean);
}

const config = {
  // ── General ──
  env: NODE_ENV,
  isProd,
  isDev: NODE_ENV === 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  // ── Database ──
  databaseUrl: process.env.DATABASE_URL,

  // ── JWT ──
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // ── CORS ──
  cors: {
    origins: parseCorsOrigins(),
  },

  // ── Cloudinary ──
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'mageed-group',
    get isConfigured() {
      return !!(this.cloudName && this.apiKey && this.apiSecret);
    },
  },

  // ── URLs ──
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.BACKEND_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 5000}`,

  // ── Rate Limiting ──
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    loginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 10,
  },

  // ── Upload Limits ──
  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10,
    get maxFileSize() {
      return this.maxFileSizeMB * 1024 * 1024;
    },
  },

  // ── Logging ──
  log: {
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    dir: process.env.LOG_DIR || 'logs',
  },
};

module.exports = config;
