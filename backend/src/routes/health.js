/**
 * MAGEED GROUP — Health & Monitoring Routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  healthCheck,
  detailedHealth,
  dbCheck,
} = require('../controllers/healthController');

// Public
router.get('/', healthCheck);

// Auth required
router.get('/detailed', auth, detailedHealth);
router.get('/db', auth, dbCheck);

module.exports = router;
