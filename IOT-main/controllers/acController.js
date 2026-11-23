const mqttService = require('../services/mqttService');
const AcRawSlot = require('../models/AcRawSlot');
const topics = require('../config/mqttTopics');

function publish(topic, payload, res) {
  if (!mqttService.client.connected) {
    return res.status(503).json({ message: 'Backend chưa kết nối MQTT broker' });
  }
  mqttService.client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (error) => {
    if (error) return res.status(500).json({ message: 'Không gửi được lệnh MQTT' });
    return res.json({ accepted: true });
  });
}

exports.getState = (req, res) => {
  res.json(mqttService.getCurrentAcState() || { control: 'none', connected: mqttService.client.connected });
};

exports.getRawSlots = async (req, res) => {
  try {
    const slots = await AcRawSlot.find().sort({ name: 1 }).select('name lastLearnedAt -_id').lean();
    res.json(slots);
  } catch (error) {
    console.error('Lỗi tải danh sách raw slot:', error);
    res.status(500).json({ message: 'Không tải được danh sách slot' });
  }
};

exports.deleteRawSlot = async (req, res) => {
  const { slot } = req.params;
  if (typeof slot !== 'string' || !/^[a-zA-Z0-9_-]{1,16}$/.test(slot)) {
    return res.status(400).json({ message: 'Tên slot không hợp lệ' });
  }
  if (!mqttService.client.connected) {
    return res.status(503).json({ message: 'Backend chưa kết nối MQTT broker' });
  }
  if (!mqttService.isOnline) {
    return res.status(503).json({ message: 'ESP32 đang offline; slot chưa bị xóa' });
  }

  try {
    const existing = await AcRawSlot.findOne({ name: slot }).lean();
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy slot đã học' });
    mqttService.client.publish(topics.acLearn, JSON.stringify({ delete: slot }), { qos: 1, retain: false }, async (error) => {
      if (error) return res.status(500).json({ message: 'Không gửi được lệnh xóa tới ESP32' });
      try {
        await AcRawSlot.deleteOne({ name: slot });
        return res.json({ accepted: true, slot });
      } catch (dbError) {
        console.error('Lỗi xóa raw slot:', dbError);
        return res.status(500).json({ message: 'Đã gửi lệnh xóa nhưng không cập nhật được danh sách' });
      }
    });
  } catch (error) {
    console.error('Lỗi xóa raw slot:', error);
    return res.status(500).json({ message: 'Không xóa được slot' });
  }
};

exports.sendCommand = (req, res) => {
  const command = req.body || {};
  const allowedKeys = new Set(['pair', 'power', 'mode', 'temp', 'fan', 'slot']);
  if (!Object.keys(command).length || Object.keys(command).some((key) => !allowedKeys.has(key))) {
    return res.status(400).json({ message: 'Lệnh điều hòa không hợp lệ' });
  }
  if (command.pair !== undefined && command.pair !== true) {
    return res.status(400).json({ message: 'pair phải là true' });
  }
  if (command.power !== undefined && ![0, 1, true, false].includes(command.power)) {
    return res.status(400).json({ message: 'power phải là 0 hoặc 1' });
  }
  if (command.mode !== undefined && !['auto', 'cool', 'dry', 'fan'].includes(command.mode)) {
    return res.status(400).json({ message: 'mode không hợp lệ' });
  }
  if (command.temp !== undefined && (!Number.isInteger(Number(command.temp)) || Number(command.temp) < 16 || Number(command.temp) > 30)) {
    return res.status(400).json({ message: 'Nhiệt độ phải từ 16 đến 30 °C' });
  }
  if (command.fan !== undefined && !['auto', 'low', 'medium', 'high'].includes(command.fan)) {
    return res.status(400).json({ message: 'Tốc độ fan không hợp lệ' });
  }
  if (command.slot !== undefined && (typeof command.slot !== 'string' || !/^[a-zA-Z0-9_-]{1,16}$/.test(command.slot))) {
    return res.status(400).json({ message: 'Tên raw slot chỉ nhận chữ, số, gạch dưới hoặc gạch ngang; tối đa 16 ký tự' });
  }
  return publish(topics.acCommand, command, res);
};

exports.learnRawSlot = (req, res) => {
  const { slot } = req.body || {};
  if (typeof slot !== 'string' || !/^[a-zA-Z0-9_-]{1,16}$/.test(slot)) {
    return res.status(400).json({ message: 'Tên slot không hợp lệ (1–16 chữ, số, _ hoặc -)' });
  }
  return publish(topics.acLearn, { slot }, res);
};
