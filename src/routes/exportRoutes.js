const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { exportCsv, exportPdf } = require('../controllers/exportController');

router.use(requireAuth);

router.get('/csv', exportCsv);
router.get('/pdf', exportPdf);

module.exports = router;
