const Settings = require('../models/Settings');
const emailService = require('../services/emailService');
let lastTestSentAt = 0;

async function getOrCreateSettings() {
  return Settings.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
}

exports.getConfig = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ enabled: settings.smokeEmailEnabled, email: settings.smokeEmailTo, smtpConfigured: emailService.isConfigured() });
  } catch (error) {
    console.error('Không tải được cài đặt email cảnh báo:', error.message);
    res.status(500).json({ message: 'Không tải được cài đặt email' });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { enabled, email } = req.body || {};
    if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled phải là true hoặc false' });
    const recipient = String(email || '').trim();
    if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return res.status(400).json({ message: 'Email nhận cảnh báo không hợp lệ' });
    }
    if (enabled && !recipient) return res.status(400).json({ message: 'Nhập email nhận trước khi bật cảnh báo' });
    const settings = await Settings.findOneAndUpdate({}, { smokeEmailEnabled: enabled, smokeEmailTo: recipient }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const mqttService = require('../services/mqttService');
    mqttService.updateAutomationSettings(settings);
    res.json({ enabled: settings.smokeEmailEnabled, email: settings.smokeEmailTo, smtpConfigured: emailService.isConfigured() });
  } catch (error) {
    console.error('Không lưu được cài đặt email cảnh báo:', error.message);
    res.status(500).json({ message: 'Không lưu được cài đặt email' });
  }
};

exports.sendTest = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const recipient = settings.smokeEmailTo;
    if (!recipient) return res.status(400).json({ message: 'Hãy lưu email nhận cảnh báo trước khi gửi thử' });
    if (Date.now() - lastTestSentAt < 60000) return res.status(429).json({ message: 'Chỉ có thể gửi email thử một lần mỗi phút' });
    await emailService.sendTestEmail(recipient);
    lastTestSentAt = Date.now();
    res.json({ sent: true });
  } catch (error) {
    console.error('Gửi email kiểm tra thất bại:', error.message);
    res.status(503).json({ message: error.message || 'Không gửi được email kiểm tra' });
  }
};
