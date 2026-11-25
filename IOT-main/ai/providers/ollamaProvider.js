class OllamaProvider {
  constructor() {
    this.name = 'ollama';
    this.model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
    this.baseUrl = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  }

  async chat({ messages, tools }) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 120000)),
      body: JSON.stringify({
        model: this.model,
        stream: false,
        tools,
        options: { temperature: 0.1, num_predict: 500, num_ctx: 8192 },
        messages
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(response.status === 404
        ? `Chưa có model “${this.model}” trong Ollama.`
        : `Ollama trả lỗi HTTP ${response.status}.`);
      error.status = response.status;
      error.detail = detail.slice(0, 400);
      throw error;
    }
    const data = await response.json();
    if (!data.message) throw new Error('Ollama không trả về message hợp lệ.');
    return { message: data.message, model: data.model || this.model };
  }
}

module.exports = OllamaProvider;
