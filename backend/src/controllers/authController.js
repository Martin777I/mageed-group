/**
 * MAGEED GROUP — Auth Controller
 * Login and session management.
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const config = require('../config/config');
const logger = require('../config/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان',
        code: 'MISSING_CREDENTIALS',
      });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      logger.logAuth({ event: 'login_failed', email, reason: 'user_not_found', ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      logger.logAuth({ event: 'login_failed', email, reason: 'wrong_password', ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const token = jwt.sign({ id: admin.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

    logger.logAuth({ event: 'login_success', email, adminId: admin.id, ip: req.ip });

    res.json({
      success: true,
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      code: 'INTERNAL_ERROR',
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId },
      select: { id: true, name: true, email: true },
    });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود',
        code: 'USER_NOT_FOUND',
      });
    }
    res.json(admin);
  } catch (error) {
    logger.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      code: 'INTERNAL_ERROR',
    });
  }
};
