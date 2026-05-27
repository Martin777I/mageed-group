const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getAllProducts,
  getProductByCode,
  createProduct,
  updateProduct,
  deleteProduct,
  importProducts,
  previewImport,
  getImportHistory,
} = require('../controllers/productController');

// Public - customer lookup by code
router.get('/code/:code', getProductByCode);

// Admin routes
router.get('/', auth, getAllProducts);
router.post('/', auth, createProduct);
router.put('/:id', auth, updateProduct);
router.delete('/:id', auth, deleteProduct);

// Import routes
router.post('/import', auth, upload.single('file'), importProducts);
router.post('/import/preview', auth, upload.single('file'), previewImport);
router.get('/import/history', auth, getImportHistory);

module.exports = router;
