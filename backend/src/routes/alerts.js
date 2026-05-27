/**
 * MAGEED GROUP — Alerts Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { lowStockAlert, alertsSummary } = require('../controllers/healthController');

router.get('/low-stock', auth, lowStockAlert);
router.get('/summary', auth, alertsSummary);

module.exports = router;
