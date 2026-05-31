const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createRetailInvoice,
  getAllRetailInvoices,
  getRetailStats,
  getRetailInvoiceById,
  searchByInvoiceNumber,
} = require('../controllers/retailController');

// All routes require auth
router.get('/stats', auth, getRetailStats);
router.get('/search/:invoiceNumber', auth, searchByInvoiceNumber);
router.get('/', auth, getAllRetailInvoices);
router.get('/:id', auth, getRetailInvoiceById);
router.post('/', auth, createRetailInvoice);

module.exports = router;
