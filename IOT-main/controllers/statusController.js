// controllers/statusController.js
const mqttService = require('../services/mqttService');

exports.getStatus = (req, res) => {
  const status = mqttService.getCurrentDeviceStatus();
  res.json({ ...status, _system: mqttService.getSystemStatus(), _desired: mqttService.getDesiredDeviceStatus() });
};
