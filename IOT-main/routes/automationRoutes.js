const express = require('express');
const controller = require('../controllers/automationController');
const router = express.Router();
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/rules', wrap(controller.listRules));
router.post('/rules', wrap(controller.createRule));
router.patch('/rules/:id', wrap(controller.updateRule));
router.delete('/rules/:id', wrap(controller.deleteRule));
router.get('/schedules', wrap(controller.listSchedules));
router.post('/schedules', wrap(controller.createSchedule));
router.delete('/schedules/:id', wrap(controller.cancelSchedule));
router.get('/scenes', wrap(controller.listScenes));
router.patch('/scenes/:key', wrap(controller.updateScene));
router.post('/scenes/:key/activate', wrap(controller.activateScene));

module.exports = router;
