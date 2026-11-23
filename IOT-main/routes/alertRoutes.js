const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.get('/config', alertController.getConfig);
router.post('/config', alertController.updateConfig);
router.post('/test', alertController.sendTest);

module.exports = router;
