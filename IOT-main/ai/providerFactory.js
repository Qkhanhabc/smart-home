const OllamaProvider = require('./providers/ollamaProvider');

function createProvider() {
  const provider = String(process.env.AI_PROVIDER || 'ollama').toLowerCase();
  if (provider === 'ollama') return new OllamaProvider();
  throw new Error(`AI_PROVIDER “${provider}” chưa được cấu hình. Hiện hệ thống hỗ trợ ollama.`);
}

module.exports = { createProvider };
