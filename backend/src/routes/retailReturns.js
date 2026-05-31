const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createRetailReturn,
  getAllRetailReturns,
  getInvoiceReturnedQuantities,
} = require('../controllers/retailReturnController');

router.get('/invoice/:invoiceId/returned', auth, getInvoiceReturnedQuantities);
router.get('/', auth, getAllRetailReturns);
router.post('/', auth, createRetailReturn);

module.exports = router;
