const express = require('express');
const router = express.Router();
const acController = require('../controllers/acController');

router.get('/state', acController.getState);
router.get('/slots', acController.getRawSlots);
router.delete('/slots/:slot', acController.deleteRawSlot);
router.post('/command', acController.sendCommand);
router.post('/learn', acController.learnRawSlot);

module.exports = router;
