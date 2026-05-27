/**
 * MAGEED GROUP — Product Controller
 * Products CRUD + Excel import with preview.
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { parseExcel } = require('../utils/excelParser');
const { validateExcelData } = require('../utils/validators');
const { processImport, IMPORT_MODES, STOCK_BEHAVIORS, generatePreview, getImportHistory } = require('../utils/importService');
const { cleanupTempFile } = require('../middleware/upload');
const { logAudit } = require('../utils/auditService');

exports.getAllProducts = async (req, res) => {
  try {
    const { search, page = 1, limit = 50, companyId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { category: { contains: search } },
      ];
    }

    if (companyId) {
      where.companyId = parseInt(companyId);
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { company: { select: { id: true, name: true, color: true, logo: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('GetAllProducts error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنتجات' });
  }
};

exports.getProductByCode = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { code: req.params.code },
      select: { id: true, code: true, name: true, price: true, stock: true, isActive: true, companyId: true },
    });
    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }
    res.json(product);
  } catch (error) {
    logger.error('GetProductByCode error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنتج' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { code, name, price, category, stock, companyId } = req.body;
    if (!code || !name || price === undefined) {
      return res.status(400).json({ message: 'كود المنتج والاسم والسعر مطلوبون' });
    }

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) {
      return res.status(409).json({ message: 'كود المنتج موجود بالفعل' });
    }

    const data = {
      code,
      name,
      price: parseFloat(price),
      category: category || null,
      stock: parseInt(stock) || 0,
    };

    if (companyId) {
      data.companyId = parseInt(companyId);
    }

    const product = await prisma.product.create({ data });

    // Audit log (non-blocking)
    logAudit({
      action: 'CREATE',
      entity: 'product',
      entityId: product.id,
      adminId: req.adminId,
      ip: req.ip,
      details: { code, name },
    });

    res.status(201).json(product);
  } catch (error) {
    logger.error('CreateProduct error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء المنتج' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, price, category, stock, isActive, companyId } = req.body;

    const data = {};
    if (code !== undefined) data.code = code;
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = Math.max(0, parseFloat(price) || 0);
    if (category !== undefined) data.category = category;
    if (stock !== undefined) data.stock = Math.max(0, parseInt(stock) || 0);
    if (isActive !== undefined) data.isActive = isActive;
    if (companyId !== undefined) data.companyId = companyId ? parseInt(companyId) : null;

    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data,
    });

    // Audit log (non-blocking)
    logAudit({
      action: 'UPDATE',
      entity: 'product',
      entityId: product.id,
      adminId: req.adminId,
      ip: req.ip,
      details: data,
    });

    res.json(product);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }
    logger.error('UpdateProduct error:', error);
    res.status(500).json({ message: 'خطأ في تحديث المنتج' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: parseInt(req.params.id) } });

    // Audit log (non-blocking)
    logAudit({
      action: 'DELETE',
      entity: 'product',
      entityId: parseInt(req.params.id),
      adminId: req.adminId,
      ip: req.ip,
    });

    res.json({ message: 'تم حذف المنتج بنجاح' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }
    logger.error('DeleteProduct error:', error);
    res.status(500).json({ message: 'خطأ في حذف المنتج' });
  }
};

// POST /api/products/import — advanced import with mode selection
exports.importProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'يرجى رفع ملف Excel' });
    }

    const mode = req.body.mode || IMPORT_MODES.CREATE_UPDATE;
    const stockBehavior = req.body.stockBehavior || STOCK_BEHAVIORS.REPLACE;

    // Validate mode
    if (!Object.values(IMPORT_MODES).includes(mode)) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({ message: 'وضع الاستيراد غير صالح' });
    }

    if (!Object.values(STOCK_BEHAVIORS).includes(stockBehavior)) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({ message: 'سلوك المخزون غير صالح' });
    }

    const result = await processImport(req.file.path, mode, stockBehavior, req.adminId, req.file.originalname);

    // Clean up uploaded file
    cleanupTempFile(req.file.path);

    res.json({
      message: `تم الاستيراد بنجاح`,
      ...result,
    });

    // Audit log (non-blocking)
    logAudit({
      action: 'IMPORT',
      entity: 'product',
      adminId: req.adminId,
      ip: req.ip,
      details: { mode, stockBehavior, created: result.created, updated: result.updated, skipped: result.skipped, fileName: req.file.originalname },
    });
  } catch (error) {
    // Clean up file on error too
    if (req.file) cleanupTempFile(req.file.path);
    logger.error('ImportProducts error:', error);
    res.status(500).json({ message: error.message || 'خطأ في استيراد المنتجات' });
  }
};

// POST /api/products/import/preview — validate only, no DB changes
exports.previewImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'يرجى رفع ملف Excel' });
    }

    const mode = req.body.mode || IMPORT_MODES.CREATE_UPDATE;
    const stockBehavior = req.body.stockBehavior || STOCK_BEHAVIORS.REPLACE;

    let rawRows;
    try {
      rawRows = parseExcel(req.file.path);
    } catch (err) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({ message: 'تعذر قراءة ملف Excel' });
    }

    if (!rawRows || rawRows.length === 0) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({ message: 'الملف فارغ' });
    }

    const { normalizedRows, validationErrors, duplicatesInFile, validRows } = validateExcelData(rawRows);
    const preview = await generatePreview(validRows, mode, stockBehavior);

    // Clean up
    cleanupTempFile(req.file.path);

    res.json({
      totalRows: normalizedRows.length,
      validRows: validRows.length,
      preview,
      validationErrors,
      duplicatesInFile,
    });
  } catch (error) {
    if (req.file) cleanupTempFile(req.file.path);
    logger.error('PreviewImport error:', error);
    res.status(500).json({ message: 'خطأ في معاينة الاستيراد' });
  }
};

// GET /api/products/import/history — import history
exports.getImportHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const result = await getImportHistory({ page, limit, search });
    res.json(result);
  } catch (error) {
    logger.error('GetImportHistory error:', error);
    res.status(500).json({ message: 'خطأ في جلب سجل الاستيراد' });
  }
};
