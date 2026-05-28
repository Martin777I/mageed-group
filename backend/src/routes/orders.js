const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrderAnalytics,
  updateOrderStatus,
  updateOrderItems,
  generatePdf,
  getStats,
  getPublicInvoice,
} = require('../controllers/orderController');

// Public routes
router.post('/', createOrder);
router.get('/invoice/:orderNumber', getPublicInvoice);

// Admin routes
router.get('/stats', auth, getStats);
router.get('/', auth, getAllOrders);
router.get('/:id', auth, getOrderById);
router.get('/:id/analytics', auth, getOrderAnalytics);
router.put('/:id/status', auth, updateOrderStatus);
router.put('/:id/items', auth, updateOrderItems);
router.get('/:id/pdf', auth, generatePdf);

module.exports = router;
