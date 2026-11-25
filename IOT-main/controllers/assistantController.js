const assistantService = require('../ai/assistantService');
const mqttService = require('../services/mqttService');

const MAX_MESSAGE_CHARS = 1200;
const MAX_HISTORY_MESSAGES = 12;
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_MINUTE = 12;
const requestTimes = new Map();

function takeRateLimit(userId) {
  const now = Date.now();
  const recent = (requestTimes.get(String(userId)) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) return false;
  recent.push(now);
  requestTimes.set(String(userId), recent);
  return true;
}

exports.chat = async (req, res) => {
  const userId = req.authUser?._id;
  if (!userId || !takeRateLimit(userId)) {
    return res.status(userId ? 429 : 401).json({ message: userId ? 'Bạn gửi câu hỏi quá nhanh. Hãy thử lại sau một phút.' : 'Vui lòng đăng nhập.' });
  }

  const history = req.body?.messages;
  if (!Array.isArray(history) || history.length < 1 || history.length > MAX_HISTORY_MESSAGES) {
    return res.status(400).json({ message: 'Lịch sử chat không hợp lệ. Hãy xóa hội thoại rồi thử lại.' });
  }
  const messages = [];
  for (const item of history) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim() || item.content.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ message: 'Tin nhắn không hợp lệ hoặc quá dài.' });
    }
    messages.push({ role: item.role, content: item.content.trim() });
  }
  if (messages[messages.length - 1].role !== 'user') return res.status(400).json({ message: 'Tin nhắn cuối cần là câu hỏi của bạn.' });

  try {
    const result = await assistantService.chat(messages, userId);
    return res.json({ ...result, systemStatus: mqttService.getSystemStatus() });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).json({ message: 'Model đang xử lý lâu hơn dự kiến. Thử câu hỏi ngắn hơn hoặc dùng model nhẹ hơn.' });
    }
    if (error.cause?.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'Ollama chưa chạy trên máy backend. Mở Ollama rồi thử lại.' });
    }
    console.error('Lỗi trợ lý local:', error);
    return res.status(500).json({ message: 'Không thể xử lý câu hỏi lúc này.' });
  }
};

exports.confirm = async (req, res) => {
  try {
    const result = await assistantService.confirmAction(req.body?.id, req.authUser._id);
    res.json({ ...result, systemStatus: mqttService.getSystemStatus() });
  } catch (error) {
    res.status(error.code === 'ESP32_OFFLINE' || error.code === 'MQTT_OFFLINE' ? 503 : 400).json({ message: error.message, code: error.code });
  }
};

exports.cancel = async (req, res) => {
  try { res.json(await assistantService.cancelAction(req.body?.id, req.authUser._id)); }
  catch (error) { res.status(400).json({ message: error.message }); }
};

exports.status = (_req, res) => {
  res.json({ ...mqttService.getSystemStatus(), devices: mqttService.getCurrentDeviceStatus(), ac: mqttService.getCurrentAcState() });
};
