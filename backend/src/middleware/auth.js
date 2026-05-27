/**
 * MAGED GROUP — Authentication Middleware
 * Verifies JWT tokens and attaches admin ID to request.
 * Enhanced with structured error responses for Flutter compatibility.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../config/logger');

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح - يرجى تسجيل الدخول',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.adminId = decoded.id;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        logger.logAuth({ event: 'token_expired', ip: req.ip });
        return res.status(401).json({
          success: false,
          message: 'انتهت صلاحية الجلسة — يرجى تسجيل الدخول مرة أخرى',
          code: 'TOKEN_EXPIRED',
        });
      }

      logger.logAuth({ event: 'invalid_token', ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN',
      });
    }
  } catch (error) {
    logger.error('Auth middleware unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في التحقق من المصادقة',
      code: 'AUTH_ERROR',
    });
  }
};

module.exports = auth;
