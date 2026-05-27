/**
 * MAGEED GROUP — Company Controller
 * CRUD for companies with Cloudinary image uploads.
 * Uses singleton PrismaClient + Cloudinary service.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { normalizeCompanyName, cleanCompanyName } = require('../utils/companyNormalizer');
const cloudinary = require('../services/cloudinaryService');
const { logAudit } = require('../utils/auditService');

// GET /api/companies — list all companies
exports.getAllCompanies = async (req, res) => {
  try {
    const { search, page = 1, limit = 50, activeOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { normalizedName: { contains: search.toLowerCase() } },
      ];
    }

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: { _count: { select: { products: true } } },
        skip,
        take: parseInt(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.company.count({ where }),
    ]);

    res.json({
      companies,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('GetAllCompanies error:', error);
    res.status(500).json({ message: 'خطأ في جلب الشركات' });
  }
};

// GET /api/companies/:id — single company
exports.getCompanyById = async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { _count: { select: { products: true } } },
    });
    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }
    res.json(company);
  } catch (error) {
    logger.error('GetCompanyById error:', error);
    res.status(500).json({ message: 'خطأ في جلب الشركة' });
  }
};

// POST /api/companies — create company
exports.createCompany = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'اسم الشركة مطلوب' });
    }

    const normalized = normalizeCompanyName(name);
    const existing = await prisma.company.findUnique({ where: { normalizedName: normalized } });
    if (existing) {
      return res.status(409).json({ message: 'شركة بنفس الاسم موجودة بالفعل' });
    }

    const data = {
      name: cleanCompanyName(name),
      normalizedName: normalized,
      color: color || '#3b82f6',
    };

    // Upload logo to Cloudinary if file provided
    if (req.file) {
      try {
        const result = await cloudinary.uploadImage(req.file.buffer, 'logos', {
          maxWidth: 400,
        });
        if (result) {
          data.logo = result.url;
          data.logoPublicId = result.publicId;
        }
      } catch (uploadError) {
        logger.warn('Logo upload failed, creating company without logo:', { error: uploadError.message });
      }
    }

    const company = await prisma.company.create({ data });

    logger.info(`Company created: ${company.name} (ID: ${company.id})`);

    // Audit log (non-blocking)
    logAudit({
      action: 'CREATE',
      entity: 'company',
      entityId: company.id,
      adminId: req.adminId,
      ip: req.ip,
      details: { name: company.name },
    });

    res.status(201).json(company);
  } catch (error) {
    logger.error('CreateCompany error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء الشركة' });
  }
};

// PUT /api/companies/:id — update company
exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, isActive } = req.body;

    const existing = await prisma.company.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }

    const data = {};

    if (name !== undefined && name.trim()) {
      const normalized = normalizeCompanyName(name);
      // Check if another company has the same normalized name
      const dupe = await prisma.company.findFirst({
        where: { normalizedName: normalized, NOT: { id: parseInt(id) } },
      });
      if (dupe) {
        return res.status(409).json({ message: 'شركة بنفس الاسم موجودة بالفعل' });
      }
      data.name = cleanCompanyName(name);
      data.normalizedName = normalized;
    }

    if (color !== undefined) data.color = color;
    if (isActive !== undefined) data.isActive = isActive === true || isActive === 'true';

    // Upload new logo to Cloudinary if file provided
    if (req.file) {
      try {
        const result = await cloudinary.uploadImage(req.file.buffer, 'logos', {
          maxWidth: 400,
        });
        if (result) {
          // Delete old logo from Cloudinary
          if (existing.logoPublicId) {
            await cloudinary.deleteImage(existing.logoPublicId);
          }
          data.logo = result.url;
          data.logoPublicId = result.publicId;
        }
      } catch (uploadError) {
        logger.warn('Logo upload failed during update:', { error: uploadError.message });
      }
    }

    const company = await prisma.company.update({
      where: { id: parseInt(id) },
      data,
    });

    // Audit log (non-blocking)
    logAudit({
      action: 'UPDATE',
      entity: 'company',
      entityId: company.id,
      adminId: req.adminId,
      ip: req.ip,
      details: data,
    });

    res.json(company);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }
    logger.error('UpdateCompany error:', error);
    res.status(500).json({ message: 'خطأ في تحديث الشركة' });
  }
};

// DELETE /api/companies/:id — soft delete
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { products: true } } },
    });

    if (!company) {
      return res.status(404).json({ message: 'الشركة غير موجودة' });
    }

    // Soft delete — set isActive to false
    await prisma.company.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    logger.info(`Company soft-deleted: ${company.name} (ID: ${company.id})`);

    // Audit log (non-blocking)
    logAudit({
      action: 'DELETE',
      entity: 'company',
      entityId: company.id,
      adminId: req.adminId,
      ip: req.ip,
      details: { name: company.name, productsCount: company._count.products },
    });

    res.json({ message: 'تم تعطيل الشركة بنجاح', productsCount: company._count.products });
  } catch (error) {
    logger.error('DeleteCompany error:', error);
    res.status(500).json({ message: 'خطأ في حذف الشركة' });
  }
};
