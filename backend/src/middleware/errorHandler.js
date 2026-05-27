/**
 * MAGEED GROUP — Centralized Error Handler
 * Catches all errors and returns consistent JSON responses.
 * Maps Prisma, Multer, and JWT errors to proper HTTP status codes.
 */

const logger = require('../config/logger');
const config = require('../config/config');

/**
 * Prisma error code → HTTP status + Arabic message
 */
const PRISMA_ERRORS = {
  P2000: { status: 400, message: 'القيمة المدخلة طويلة جداً' },
  P2001: { status: 404, message: 'السجل المطلوب غير موجود' },
  P2002: { status: 409, message: 'هذا السجل موجود بالفعل (تكرار في البيانات)' },
  P2003: { status: 400, message: 'فشل بسبب قيد مرجعي (بيانات مرتبطة)' },
  P2025: { status: 404, message: 'السجل المطلوب غير موجود' },
};

/**
 * Multer error messages
 */
const MULTER_ERRORS = {
  LIMIT_FILE_SIZE: 'حجم الملف يتجاوز الحد المسموح',
  LIMIT_FILE_COUNT: 'عدد الملفات يتجاوز الحد المسموح',
  LIMIT_UNEXPECTED_FILE: 'حقل الملف غير متوقع',
};

function errorHandler(err, req, res, _next) {
  // ── Already sent response ──
  if (res.headersSent) {
    return;
  }

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'خطأ في الخادم';
  let code = 'INTERNAL_ERROR';
  let details = undefined;

  // ── Prisma errors ──
  if (err.code && PRISMA_ERRORS[err.code]) {
    const mapped = PRISMA_ERRORS[err.code];
    status = mapped.status;
    message = mapped.message;
    code = `PRISMA_${err.code}`;

    // Add field info for unique constraint violations
    if (err.code === 'P2002' && err.meta?.target) {
      details = { field: err.meta.target };
    }
  }

  // ── Multer errors ──
  if (err.name === 'MulterError') {
    status = 400;
    message = MULTER_ERRORS[err.code] || 'خطأ في رفع الملف';
    code = `UPLOAD_${err.code}`;
  }

  // ── Multer custom errors (file filter rejects) ──
  if (err.message && (err.message.includes('يُسمح فقط') || err.message.includes('Excel'))) {
    status = 400;
    code = 'UPLOAD_INVALID_TYPE';
  }

  // ── JWT errors ──
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'رمز المصادقة غير صالح';
    code = 'INVALID_TOKEN';
  }
  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى';
    code = 'TOKEN_EXPIRED';
  }

  // ── Validation errors (express-validator) ──
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'بيانات JSON غير صالحة';
    code = 'INVALID_JSON';
  }

  // ── CORS errors ──
  if (err.message && err.message.includes('CORS')) {
    status = 403;
    message = 'الوصول غير مسموح من هذا المصدر';
    code = 'CORS_ERROR';
  }

  // ── Log the error ──
  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${status}: ${err.message}`, {
      stack: err.stack,
      body: req.body,
      params: req.params,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${status}: ${message}`);
  }

  // ── Response ──
  const response = {
    success: false,
    message,
    code,
  };

  // Include details for specific errors
  if (details) {
    response.details = details;
  }

  // Include stack trace in development only
  if (config.isDev && err.stack) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
}

module.exports = errorHandler;
