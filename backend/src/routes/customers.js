const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getAllCustomers,
  getCustomerById,
  getCustomerOrders,
  getCustomerReturns,
  updateCustomer,
  searchByPhone,
  searchByCode,
} = require('../controllers/customerController');

router.get('/', auth, getAllCustomers);
router.get('/search/phone/:phone', auth, searchByPhone);
router.get('/search/code/:code', auth, searchByCode);
router.get('/:id', auth, getCustomerById);
router.get('/:id/orders', auth, getCustomerOrders);
router.get('/:id/returns', auth, getCustomerReturns);
router.put('/:id', auth, updateCustomer);

module.exports = router;
