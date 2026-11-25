const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');

router.post('/chat', assistantController.chat);
router.post('/confirm', assistantController.confirm);
router.post('/cancel', assistantController.cancel);
router.get('/status', assistantController.status);
module.exports = router;
