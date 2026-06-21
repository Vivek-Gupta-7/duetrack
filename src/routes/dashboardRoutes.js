const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getStats, getRecent } = require('../controllers/dashboardController');

router.use(requireAuth);

router.get('/stats', getStats);
router.get('/recent', getRecent);

module.exports = router;
