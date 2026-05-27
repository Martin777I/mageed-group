/**
 * MAGED GROUP — Upload Middleware
 * 
 * Excel files: disk storage (needed for xlsx parsing)
 * Images (logos): memory storage (buffer → Cloudinary)
 * 
 * Auto-cleanup of temp files is handled by controllers after processing.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// ── Ensure upload directory exists (for Excel temp files) ──
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ══════════════════════════════════════════════
//  EXCEL UPLOADS — Disk storage (temp files)
// ══════════════════════════════════════════════

const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const excelFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  // Also check file extension as backup
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.xlsx', '.xls'];

  if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('يُسمح فقط بملفات Excel (.xlsx, .xls)'), false);
  }
};

const upload = multer({
  storage: excelStorage,
  fileFilter: excelFilter,
  limits: {
    fileSize: config.upload.maxFileSize, // From config (default 10MB)
    files: 1,
  },
});

// ══════════════════════════════════════════════
//  IMAGE UPLOADS — Memory storage (buffer → Cloudinary)
// ══════════════════════════════════════════════

const imageStorage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  // Also check extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('يُسمح فقط بصور JPG, PNG, WebP, GIF'), false);
  }
};

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for images
    files: 1,
  },
});

// ══════════════════════════════════════════════
//  CLEANUP UTILITY
// ══════════════════════════════════════════════

/**
 * Safely delete a temp file
 * @param {string} filePath - Path to the file to delete
 */
function cleanupTempFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // Ignore cleanup errors — not critical
  }
}

/**
 * Clean all temp files from uploads directory
 * (Except the logos subdirectory)
 */
function cleanupAllTempFiles() {
  try {
    const files = fs.readdirSync(uploadDir);
    let cleaned = 0;
    for (const file of files) {
      const fullPath = path.join(uploadDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        fs.unlinkSync(fullPath);
        cleaned++;
      }
    }
    return cleaned;
  } catch (e) {
    return 0;
  }
}

module.exports = upload;
module.exports.uploadImage = uploadImage;
module.exports.cleanupTempFile = cleanupTempFile;
module.exports.cleanupAllTempFiles = cleanupAllTempFiles;
