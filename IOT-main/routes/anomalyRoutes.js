const express = require('express');
const router = express.Router();
const anomalyController = require('../controllers/anomalyController');

router.get('/recent', anomalyController.getRecent);
module.exports = router;
