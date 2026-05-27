const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createReturn,
  getAllReturns,
  getReturnById,
  getOrderReturnedQuantities,
  getReturnStats,
} = require('../controllers/returnController');

router.get('/stats', auth, getReturnStats);
router.get('/order/:orderId/returned', auth, getOrderReturnedQuantities);
router.get('/', auth, getAllReturns);
router.get('/:id', auth, getReturnById);
router.post('/', auth, createReturn);

module.exports = router;
