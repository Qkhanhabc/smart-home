// routes/statsRoutes.js
const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

// GET /api/stats/thresholds - Lấy thống kê vượt ngưỡng
router.get('/thresholds', statsController.getThresholdStats);

// GET /api/stats/toggles - Lấy thống kê bật/tắt
router.get('/toggles', statsController.getDeviceToggleStats);

module.exports = router;