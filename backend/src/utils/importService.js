/**
 * Advanced Excel Import Service
 * Handles CREATE_ONLY, UPDATE_ONLY, CREATE_UPDATE, VALIDATE_ONLY modes
 * With STOCK BEHAVIOR: REPLACE, ADD, SUBTRACT
 * Uses Prisma transactions for atomic operations.
 * 
 * Uses singleton PrismaClient + structured logging.
 */

const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { parseExcel } = require('./excelParser');
const { validateExcelData } = require('./validators');
const { normalizeCompanyName, cleanCompanyName } = require('./companyNormalizer');
const fs = require('fs');

const IMPORT_MODES = {
  CREATE_ONLY: 'CREATE_ONLY',
  UPDATE_ONLY: 'UPDATE_ONLY',
  CREATE_UPDATE: 'CREATE_UPDATE',
  VALIDATE_ONLY: 'VALIDATE_ONLY',
};

const STOCK_BEHAVIORS = {
  REPLACE: 'REPLACE',
  ADD: 'ADD',
  SUBTRACT: 'SUBTRACT',
};

/**
 * Calculate the resulting stock based on behavior
 */
function calculateStock(currentStock, importedStock, behavior) {
  switch (behavior) {
    case STOCK_BEHAVIORS.ADD:
      return currentStock + importedStock;
    case STOCK_BEHAVIORS.SUBTRACT:
      return Math.max(0, currentStock - importedStock);
    case STOCK_BEHAVIORS.REPLACE:
    default:
      return importedStock;
  }
}

/**
 * Resolve a company name to a company ID, auto-creating if needed.
 */
async function resolveCompany(companyName, companyCache, tx) {
  if (!companyName) return null;

  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return null;

  if (companyCache.has(normalized)) {
    return companyCache.get(normalized);
  }

  let company = await tx.company.findUnique({ where: { normalizedName: normalized } });

  if (!company) {
    company = await tx.company.create({
      data: {
        name: cleanCompanyName(companyName),
        normalizedName: normalized,
      },
    });
  }

  companyCache.set(normalized, company.id);
  return company.id;
}

/**
 * Generate preview data for all valid rows
 */
async function generatePreview(validRows, mode, stockBehavior = 'REPLACE') {
  const existingProducts = await prisma.product.findMany({
    where: { code: { in: validRows.map((r) => r.code) } },
    select: { code: true, stock: true, name: true, price: true },
  });
  const existingMap = {};
  for (const p of existingProducts) {
    existingMap[p.code] = p;
  }

  const preview = validRows.map((row) => {
    const existing = existingMap[row.code];
    const exists = !!existing;
    let action = 'SKIP';

    switch (mode) {
      case IMPORT_MODES.CREATE_ONLY:
        action = exists ? 'SKIP' : 'CREATE';
        break;
      case IMPORT_MODES.UPDATE_ONLY:
        action = exists ? 'UPDATE' : 'SKIP';
        break;
      case IMPORT_MODES.CREATE_UPDATE:
        action = exists ? 'UPDATE' : 'CREATE';
        break;
      case IMPORT_MODES.VALIDATE_ONLY:
        action = exists ? 'UPDATE' : 'CREATE';
        break;
    }

    const importedStock = parseInt(row.stock) || 0;
    const oldStock = existing ? existing.stock : 0;
    let resultingStock = importedStock;

    if (exists && action === 'UPDATE') {
      resultingStock = calculateStock(oldStock, importedStock, stockBehavior);
    }

    return {
      rowNumber: row.rowNumber,
      code: row.code,
      name: row.name,
      price: row.price,
      stock: row.stock,
      category: row.category,
      company: row.company,
      action,
      exists,
      oldStock,
      importedStock,
      resultingStock,
    };
  });

  return preview;
}

/**
 * Main import function
 *
 * @param {string} filePath - Path to the uploaded Excel file
 * @param {string} mode - One of IMPORT_MODES
 * @param {string} stockBehavior - One of STOCK_BEHAVIORS
 * @param {number} adminId - Admin performing the import
 * @param {string} fileName - Original file name
 * @returns {object} Import result summary
 */
async function processImport(filePath, mode, stockBehavior, adminId, fileName) {
  let rawRows;
  try {
    rawRows = parseExcel(filePath);
  } catch (err) {
    throw new Error('تعذر قراءة ملف Excel. تأكد من أن الملف بصيغة .xlsx صالحة');
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error('الملف فارغ أو لا يحتوي على بيانات');
  }

  // Memory safety: reject files that are too large
  if (rawRows.length > 10000) {
    throw new Error(`الملف يحتوي على ${rawRows.length} صف — الحد الأقصى هو 10,000 صف`);
  }

  const sb = stockBehavior || STOCK_BEHAVIORS.REPLACE;

  logger.logImport({
    action: 'START',
    fileName,
    mode,
    stockBehavior: sb,
    totalRows: rawRows.length,
    adminId,
  });

  // Step 1: Validate all rows
  const { normalizedRows, validationErrors, duplicatesInFile, validRows } = validateExcelData(rawRows);

  // Step 2: Generate preview
  const preview = await generatePreview(validRows, mode, sb);

  // Build result skeleton
  const result = {
    mode,
    stockBehavior: sb,
    totalRows: normalizedRows.length,
    validRows: validRows.length,
    preview,
    validationErrors,
    duplicatesInFile,
    created: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
  };

  // If VALIDATE_ONLY, return preview without any DB changes
  if (mode === IMPORT_MODES.VALIDATE_ONLY) {
    result.skipped = validRows.length;
    return result;
  }

  // Step 3: Execute import inside a transaction
  try {
    await prisma.$transaction(async (tx) => {
      const companyCache = new Map();

      for (const row of validRows) {
        const code = row.code;
        const existing = await tx.product.findUnique({ where: { code } });

        // Resolve company
        let companyId = null;
        try {
          companyId = await resolveCompany(row.company, companyCache, tx);
        } catch (companyErr) {
          result.warnings.push({
            rowNumber: row.rowNumber,
            message: `تعذر إنشاء/ربط الشركة "${row.company}": ${companyErr.message}`,
          });
        }

        const importedStock = parseInt(row.stock) || 0;

        switch (mode) {
          case IMPORT_MODES.CREATE_ONLY:
            if (existing) {
              result.skipped++;
              result.warnings.push({
                rowNumber: row.rowNumber,
                message: `الكود "${code}" موجود مسبقاً — تم التخطي`,
              });
            } else {
              const finalStock = importedStock;
              if (finalStock < 0) {
                result.warnings.push({ rowNumber: row.rowNumber, message: `المخزون سالب — تم تعيينه إلى 0` });
              }
              await tx.product.create({
                data: {
                  code,
                  name: row.name,
                  price: parseFloat(row.price) || 0,
                  category: row.category || null,
                  stock: Math.max(0, finalStock),
                  ...(companyId !== null && { companyId }),
                },
              });
              result.created++;
            }
            break;

          case IMPORT_MODES.UPDATE_ONLY:
            if (!existing) {
              result.skipped++;
              result.warnings.push({
                rowNumber: row.rowNumber,
                message: `الكود "${code}" غير موجود — تم التخطي`,
              });
            } else {
              const finalStock = calculateStock(existing.stock, importedStock, sb);
              if (finalStock < 0) {
                result.warnings.push({ rowNumber: row.rowNumber, message: `المخزون الناتج سالب — تم تعيينه إلى 0` });
              }
              await tx.product.update({
                where: { code },
                data: {
                  name: row.name,
                  price: parseFloat(row.price) || 0,
                  category: row.category || null,
                  stock: Math.max(0, finalStock),
                  ...(companyId !== null && { companyId }),
                },
              });
              result.updated++;
            }
            break;

          case IMPORT_MODES.CREATE_UPDATE:
            if (existing) {
              const finalStock = calculateStock(existing.stock, importedStock, sb);
              if (finalStock < 0) {
                result.warnings.push({ rowNumber: row.rowNumber, message: `المخزون الناتج سالب — تم تعيينه إلى 0` });
              }
              await tx.product.update({
                where: { code },
                data: {
                  name: row.name,
                  price: parseFloat(row.price) || 0,
                  category: row.category || null,
                  stock: Math.max(0, finalStock),
                  ...(companyId !== null && { companyId }),
                },
              });
              result.updated++;
            } else {
              const finalStock = importedStock;
              if (finalStock < 0) {
                result.warnings.push({ rowNumber: row.rowNumber, message: `المخزون سالب — تم تعيينه إلى 0` });
              }
              await tx.product.create({
                data: {
                  code,
                  name: row.name,
                  price: parseFloat(row.price) || 0,
                  category: row.category || null,
                  stock: Math.max(0, finalStock),
                  ...(companyId !== null && { companyId }),
                },
              });
              result.created++;
            }
            break;
        }
      }
    }, { timeout: 60000 });
  } catch (txError) {
    logger.error('Import transaction failed:', { error: txError.message, fileName, mode });
    throw new Error('فشل الاستيراد — تم التراجع عن جميع العمليات. السبب: ' + txError.message);
  }

  // Step 4: Log the import
  try {
    const detailsSummary = JSON.stringify({
      stockBehavior: sb,
      validationErrors: result.validationErrors.slice(0, 100),
      duplicatesInFile: result.duplicatesInFile,
      warnings: result.warnings.slice(0, 100),
    });

    await prisma.importLog.create({
      data: {
        adminId,
        fileName: fileName || 'unknown.xlsx',
        mode: `${mode} | ${sb}`,
        totalRows: result.totalRows,
        createdCount: result.created,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        errorsCount: result.validationErrors.length,
        details: detailsSummary,
      },
    });
  } catch (logError) {
    logger.error('Failed to save import log:', { error: logError.message });
  }

  logger.logImport({
    action: 'COMPLETE',
    fileName,
    mode,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    errors: result.validationErrors.length,
  });

  return result;
}

/**
 * Get import history with pagination
 */
async function getImportHistory({ page = 1, limit = 20, search = '' }) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = search
    ? {
      OR: [
        { fileName: { contains: search } },
        { mode: { contains: search } },
      ],
    }
    : {};

  const [logs, total] = await Promise.all([
    prisma.importLog.findMany({
      where,
      include: { admin: { select: { name: true, email: true } } },
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.importLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
}

module.exports = {
  IMPORT_MODES,
  STOCK_BEHAVIORS,
  processImport,
  generatePreview,
  getImportHistory,
};
