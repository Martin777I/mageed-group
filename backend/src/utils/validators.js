/**
 * Excel row validation utilities
 * Validates required fields, numeric fields, detects duplicates
 */

const COLUMN_MAP = {
  code:     ['code', 'Code', 'كود'],
  name:     ['name', 'Name', 'اسم', 'اسم المنتج'],
  price:    ['price', 'Price', 'سعر'],
  stock:    ['stock', 'Stock', 'مخزون'],
  category: ['category', 'Category', 'فئة'],
  company:  ['company', 'Company', 'شركة'],
};

/**
 * Extract a value from a row using multiple possible column headers
 */
function extractField(row, fieldName) {
  const keys = COLUMN_MAP[fieldName] || [];
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

/**
 * Normalize a single row into a standard format
 */
function normalizeRow(row, rowIndex) {
  return {
    rowNumber: rowIndex + 2, // +2 because Excel rows are 1-indexed and row 1 is the header
    code: extractField(row, 'code'),
    name: extractField(row, 'name'),
    price: extractField(row, 'price'),
    stock: extractField(row, 'stock'),
    category: extractField(row, 'category'),
    company: extractField(row, 'company'),
    _raw: row,
  };
}

/**
 * Validate a single normalized row
 * Returns array of error objects { rowNumber, field, error }
 */
function validateRow(normalizedRow) {
  const errors = [];
  const { rowNumber, code, name, price, stock } = normalizedRow;

  // Required fields
  if (!code) {
    errors.push({ rowNumber, field: 'code', error: 'الكود مطلوب', type: 'REQUIRED' });
  }
  if (!name) {
    errors.push({ rowNumber, field: 'name', error: 'الاسم مطلوب', type: 'REQUIRED' });
  }

  // Numeric validation
  if (price && isNaN(parseFloat(price))) {
    errors.push({ rowNumber, field: 'price', error: `قيمة السعر غير صالحة: "${price}"`, type: 'INVALID_NUMBER' });
  } else if (price && parseFloat(price) < 0) {
    errors.push({ rowNumber, field: 'price', error: `السعر لا يمكن أن يكون سالبًا: "${price}"`, type: 'INVALID_NUMBER' });
  }

  if (stock && isNaN(parseInt(stock))) {
    errors.push({ rowNumber, field: 'stock', error: `قيمة المخزون غير صالحة: "${stock}"`, type: 'INVALID_NUMBER' });
  } else if (stock && parseInt(stock) < 0) {
    errors.push({ rowNumber, field: 'stock', error: `المخزون لا يمكن أن يكون سالبًا: "${stock}"`, type: 'INVALID_NUMBER' });
  }

  return errors;
}

/**
 * Detect duplicate codes within the Excel file itself
 * Returns array of { code, rows: [rowNumbers] }
 */
function detectDuplicatesInFile(normalizedRows) {
  const codeMap = {};
  for (const row of normalizedRows) {
    if (!row.code) continue;
    const key = row.code.toLowerCase();
    if (!codeMap[key]) {
      codeMap[key] = { code: row.code, rows: [] };
    }
    codeMap[key].rows.push(row.rowNumber);
  }

  return Object.values(codeMap).filter((entry) => entry.rows.length > 1);
}

/**
 * Full validation pipeline
 * Returns { normalizedRows, validationErrors, duplicatesInFile, validRows }
 */
function validateExcelData(rawRows) {
  // Normalize all rows
  const normalizedRows = rawRows.map((row, idx) => normalizeRow(row, idx));

  // Validate each row
  const validationErrors = [];
  for (const row of normalizedRows) {
    const rowErrors = validateRow(row);
    validationErrors.push(...rowErrors);
  }

  // Detect duplicates within file
  const duplicatesInFile = detectDuplicatesInFile(normalizedRows);

  // Collect row numbers with errors
  const errorRowNumbers = new Set(validationErrors.map((e) => e.rowNumber));
  // Collect row numbers that are part of duplicates
  const duplicateRowNumbers = new Set();
  for (const dup of duplicatesInFile) {
    // Mark all but the first occurrence as duplicate
    for (let i = 1; i < dup.rows.length; i++) {
      duplicateRowNumbers.add(dup.rows[i]);
    }
  }

  // Valid rows = have code+name, no errors, not a duplicate extra
  const validRows = normalizedRows.filter(
    (row) => row.code && row.name && !errorRowNumbers.has(row.rowNumber) && !duplicateRowNumbers.has(row.rowNumber)
  );

  return { normalizedRows, validationErrors, duplicatesInFile, validRows };
}

module.exports = {
  COLUMN_MAP,
  extractField,
  normalizeRow,
  validateRow,
  detectDuplicatesInFile,
  validateExcelData,
};
