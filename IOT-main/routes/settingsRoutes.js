// routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// GET /api/settings - Lấy cài đặt ngưỡng hiện tại
router.get('/', settingsController.getSettings);

// POST /api/settings - Cập nhật cài đặt ngưỡng
router.post('/', settingsController.updateSettings);

module.exports = router;