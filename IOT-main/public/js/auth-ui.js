(() => {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    const account = document.createElement('a');
    account.href = '/account.html';
    account.className = 'btn btn-outline-light mx-3 mt-auto mb-2';
    account.innerHTML = '<i class="fa-solid fa-user me-2"></i>Tài khoản';
    sidebar.appendChild(account);

    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'btn btn-outline-light mx-3';
    logout.innerHTML = '<i class="fa-solid fa-right-from-bracket me-2"></i>Đăng xuất';
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try { await fetch('/api/auth/logout', { method: 'POST' }); }
      finally { location.replace('/login.html'); }
    });
    sidebar.appendChild(logout);
  }

  const style = document.createElement('style');
  style.textContent = `
    :root{--ai-navy:#0c2d55;--ai-blue:#1769d2;--ai-soft:#eef5ff;--ai-border:#dce5f0;--ai-danger:#bc2f3a}
    #smart-ai-launcher{position:fixed;right:22px;bottom:22px;z-index:1080;border:0;border-radius:999px;padding:13px 18px;background:linear-gradient(135deg,#0d3b73,#1769d2);color:#fff;box-shadow:0 12px 28px #0b28574d;font-weight:700;display:flex;align-items:center;gap:9px}
    #smart-ai-launcher .ai-pulse{width:9px;height:9px;border-radius:50%;background:#55d68a;box-shadow:0 0 0 5px #55d68a22}
    #smart-ai-panel{position:fixed;right:22px;bottom:82px;z-index:1080;width:min(440px,calc(100vw - 28px));height:min(680px,calc(100vh - 108px));background:#fff;border-radius:20px;box-shadow:0 20px 60px #11182745;display:none;flex-direction:column;overflow:hidden;border:1px solid var(--ai-border)}
    #smart-ai-panel.open{display:flex}.smart-ai-head{padding:15px 17px;background:linear-gradient(135deg,#0a274a,#154f90);color:#fff;display:flex;align-items:center;gap:12px}.smart-ai-avatar{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:#ffffff19;border:1px solid #ffffff2f;font-size:1.2rem}.smart-ai-title{flex:1}.smart-ai-title strong{display:block}.smart-ai-status{display:flex;align-items:center;gap:6px;color:#c9d8eb;font-size:.76rem}.smart-ai-status-dot{width:8px;height:8px;border-radius:50%;background:#9ca3af}.smart-ai-status-dot.online{background:#4ade80}.smart-ai-status-dot.offline{background:#fb7185}.smart-ai-close{border:0;background:transparent;color:#fff;font-size:1.35rem;padding:4px 7px}
    .smart-ai-alert{display:none;padding:8px 14px;background:#fff0f1;color:#8c2029;font-size:.78rem;border-bottom:1px solid #ffd6da}.smart-ai-alert.show{display:block}
    #smart-ai-messages{flex:1;overflow:auto;padding:15px;background:linear-gradient(#f6f9fc,#f2f6fb);display:flex;flex-direction:column;gap:11px}.smart-ai-msg{white-space:pre-wrap;overflow-wrap:anywhere;max-width:89%;padding:10px 12px;border-radius:15px;font-size:.91rem;line-height:1.48}.smart-ai-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-bottom-left-radius:5px}.smart-ai-msg.user{align-self:flex-end;background:#dcecff;color:#102e54;border-bottom-right-radius:5px}.smart-ai-msg.error{color:#9f1f29;border-color:#facbd0;background:#fff5f5}
    .smart-ai-tools{align-self:stretch;display:grid;gap:8px}.smart-ai-result{background:#fff;border:1px solid var(--ai-border);border-radius:13px;padding:10px 11px;font-size:.8rem}.smart-ai-result-head{display:flex;justify-content:space-between;gap:8px;font-weight:700;color:#173b67}.smart-ai-badge{border-radius:999px;padding:2px 7px;background:#e8f3ff;color:#1559a7;font-size:.68rem}.smart-ai-badge.warn{background:#fff3d6;color:#895d00}.smart-ai-badge.ok{background:#e4f8ea;color:#16723a}.smart-ai-badge.bad{background:#ffe7e9;color:#9f1f29}.smart-ai-metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:8px}.smart-ai-metric{padding:8px;border-radius:10px;background:#f4f8fd}.smart-ai-metric b{display:block;color:#123c70;font-size:1rem}.smart-ai-result details{margin-top:6px;color:#5c6878}.smart-ai-result pre{white-space:pre-wrap;max-height:140px;overflow:auto;font-size:.7rem;margin:6px 0 0}
    .smart-ai-confirm{align-self:stretch;background:#fffaf0;border:1px solid #f5d79a;border-radius:14px;padding:11px}.smart-ai-confirm strong{display:block;color:#6f4a00;font-size:.84rem}.smart-ai-confirm p{font-size:.79rem;margin:5px 0 9px}.smart-ai-confirm-actions{display:flex;gap:8px}.smart-ai-confirm button{font-size:.78rem}
    .smart-ai-typing{display:flex;gap:4px;align-items:center}.smart-ai-typing i{width:6px;height:6px;border-radius:50%;background:#6c7b8f;animation:smartAiBounce 1s infinite alternate}.smart-ai-typing i:nth-child(2){animation-delay:.2s}.smart-ai-typing i:nth-child(3){animation-delay:.4s}@keyframes smartAiBounce{to{transform:translateY(-5px);opacity:.45}}
    .smart-ai-quick{display:flex;gap:7px;overflow:auto;padding:9px 11px;border-top:1px solid #e7edf4;background:#fff}.smart-ai-quick button{white-space:nowrap;border:1px solid #d6e2f0;background:#f7faff;color:#1b4f86;border-radius:999px;padding:6px 10px;font-size:.75rem}
    .smart-ai-foot{padding:10px 11px 9px;border-top:1px solid #e8edf3;background:#fff}.smart-ai-foot form{display:flex;gap:8px}.smart-ai-foot textarea{resize:none;min-height:45px;max-height:105px;border-radius:13px}.smart-ai-foot button{align-self:flex-end;height:45px;width:45px;border-radius:12px}.smart-ai-note{font-size:.68rem;color:#748092;margin-top:6px;text-align:center}
    @media(max-width:520px){#smart-ai-panel{right:0;bottom:0;width:100vw;height:100dvh;max-height:none;border-radius:0;border:0}#smart-ai-launcher{right:12px;bottom:12px}.smart-ai-metrics{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.id = 'smart-ai-launcher';
  launcher.type = 'button';
  launcher.innerHTML = '<span class="ai-pulse"></span><span>AI Smart Home</span>';
  launcher.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('section');
  panel.id = 'smart-ai-panel';
  panel.setAttribute('aria-label', 'AI Smart Home Assistant');
  panel.innerHTML = `
    <header class="smart-ai-head">
      <div class="smart-ai-avatar">✦</div>
      <div class="smart-ai-title"><strong>AI Smart Home Assistant</strong><span class="smart-ai-status"><i class="smart-ai-status-dot"></i><span>Đang kiểm tra ESP32…</span></span></div>
      <button type="button" class="smart-ai-close" aria-label="Đóng">×</button>
    </header>
    <div class="smart-ai-alert" role="alert"></div>
    <div id="smart-ai-messages" aria-live="polite"></div>
    <div class="smart-ai-quick" aria-label="Lệnh gợi ý"></div>
    <div class="smart-ai-foot">
      <form><textarea class="form-control" maxlength="1200" placeholder="Hỏi hoặc điều khiển ngôi nhà…" aria-label="Nhập tin nhắn"></textarea><button class="btn btn-primary" type="submit" aria-label="Gửi"><i class="fa-solid fa-paper-plane">➤</i></button></form>
      <div class="smart-ai-note">AI dùng dữ liệu thật và chỉ điều khiển qua các công cụ backend được cấp quyền.</div>
    </div>`;
  document.body.append(launcher, panel);

  const history = [];
  const messages = panel.querySelector('#smart-ai-messages');
  const input = panel.querySelector('textarea');
  const sendButton = panel.querySelector('button[type="submit"]');
  const statusDot = panel.querySelector('.smart-ai-status-dot');
  const statusText = panel.querySelector('.smart-ai-status span');
  const alertBox = panel.querySelector('.smart-ai-alert');
  let busy = false;

  function scrollBottom() { messages.scrollTop = messages.scrollHeight; }
  function addMessage(role, content, extraClass = '') {
    const bubble = document.createElement('div');
    bubble.className = `smart-ai-msg ${role} ${extraClass}`.trim();
    bubble.textContent = content;
    messages.appendChild(bubble); scrollBottom(); return bubble;
  }
  function addTyping() {
    const bubble = document.createElement('div');
    bubble.className = 'smart-ai-msg assistant smart-ai-typing';
    bubble.innerHTML = '<i></i><i></i><i></i>';
    messages.appendChild(bubble); scrollBottom(); return bubble;
  }
  function statusBadge(result) {
    if (result?.confirmation === 'reported_by_esp32' && result?.esp32Reported) return ['ESP32 đã báo', 'ok'];
    if (result?.ok === true && result?.confirmation !== 'ir_command_only') return ['Thành công', 'ok'];
    if (result?.status === 'sent_unconfirmed' || result?.confirmation === 'ir_command_only') return ['Chưa xác minh vật lý', 'warn'];
    if (result?.ok === false) return ['Thất bại', 'bad'];
    return ['Dữ liệu thật', ''];
  }
  function renderToolResults(toolResults = []) {
    if (!toolResults.length) return;
    const wrap = document.createElement('div'); wrap.className = 'smart-ai-tools';
    for (const item of toolResults) {
      const card = document.createElement('div'); card.className = 'smart-ai-result';
      const [badge, badgeClass] = statusBadge(item.result);
      const head = document.createElement('div'); head.className = 'smart-ai-result-head';
      const label = document.createElement('span'); label.textContent = item.name.replaceAll('_', ' ');
      const state = document.createElement('span'); state.className = `smart-ai-badge ${badgeClass}`; state.textContent = badge;
      head.append(label, state); card.appendChild(head);
      const sample = item.result?.sample;
      if (sample) {
        const metrics = document.createElement('div'); metrics.className = 'smart-ai-metrics';
        [['Nhiệt độ', sample.temperature == null ? '—' : `${sample.temperature} °C`], ['Độ ẩm', sample.humidity == null ? '—' : `${sample.humidity} %`], ['Ánh sáng', sample.light ?? '—'], ['MQ-2', sample.mq2 ?? '—']].forEach(([metricLabel, value]) => {
          const node = document.createElement('div'); node.className = 'smart-ai-metric';
          const small = document.createElement('small'); small.textContent = metricLabel;
          const strong = document.createElement('b'); strong.textContent = value;
          node.append(small, strong); metrics.appendChild(node);
        });
        card.appendChild(metrics);
      } else if (item.result?.message) {
        const text = document.createElement('div'); text.style.marginTop = '6px'; text.textContent = item.result.message; card.appendChild(text);
      }
      const details = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = 'Chi tiết kỹ thuật';
      const pre = document.createElement('pre'); pre.textContent = JSON.stringify(item.result, null, 2);
      details.append(summary, pre); card.appendChild(details); wrap.appendChild(card);
    }
    messages.appendChild(wrap); scrollBottom();
  }
  function renderPending(actions = []) {
    actions.forEach((action) => {
      const card = document.createElement('div'); card.className = 'smart-ai-confirm';
      const title = document.createElement('strong'); title.textContent = 'Cần bạn xác nhận';
      const description = document.createElement('p'); description.textContent = action.summary;
      const controls = document.createElement('div'); controls.className = 'smart-ai-confirm-actions';
      const confirm = document.createElement('button'); confirm.className = 'btn btn-sm btn-warning'; confirm.textContent = 'Xác nhận';
      const cancel = document.createElement('button'); cancel.className = 'btn btn-sm btn-outline-secondary'; cancel.textContent = 'Hủy';
      controls.append(confirm, cancel); card.append(title, description, controls); messages.appendChild(card);
      async function decide(endpoint) {
        confirm.disabled = cancel.disabled = true;
        try {
          const response = await fetch(`/api/assistant/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: action.id }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || 'Không xử lý được xác nhận.');
          card.remove(); addMessage('assistant', data.answer || (endpoint === 'confirm' ? 'Đã thực hiện.' : 'Đã hủy.'));
          if (data.result) renderToolResults([{ name: data.toolName || 'confirmed_action', result: data.result }]);
          await refreshStatus();
        } catch (error) { confirm.disabled = cancel.disabled = false; addMessage('assistant', error.message, 'error'); }
      }
      confirm.addEventListener('click', () => decide('confirm')); cancel.addEventListener('click', () => decide('cancel'));
    });
    scrollBottom();
  }
  async function refreshStatus() {
    try {
      const response = await fetch('/api/assistant/status');
      if (!response.ok) throw new Error();
      const data = await response.json(); const online = data.esp32Online;
      statusDot.className = `smart-ai-status-dot ${online ? 'online' : 'offline'}`;
      statusText.textContent = online ? `ESP32 trực tuyến${data.sensorAgeSeconds == null ? '' : ` · dữ liệu ${data.sensorAgeSeconds}s`}` : 'ESP32 ngoại tuyến';
      alertBox.classList.toggle('show', !online || !data.sensorFresh);
      alertBox.textContent = !online ? 'Không thể điều khiển: ESP32 đang ngoại tuyến.' : !data.sensorFresh ? 'Dữ liệu cảm biến đang cũ; trợ lý sẽ thông báo rõ khi trả lời.' : '';
      launcher.querySelector('.ai-pulse').style.background = online ? '#55d68a' : '#fb7185';
    } catch { statusDot.className = 'smart-ai-status-dot offline'; statusText.textContent = 'Không đọc được trạng thái backend'; }
  }
  async function send(text) {
    if (!text || busy) return;
    busy = true; input.value = ''; history.push({ role: 'user', content: text }); addMessage('user', text);
    const typing = addTyping(); sendButton.disabled = true;
    try {
      const response = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-12) }) });
      const data = await response.json().catch(() => ({})); typing.remove();
      if (!response.ok) throw new Error(data.message || 'Không nhận được câu trả lời.');
      addMessage('assistant', data.answer); renderToolResults(data.toolResults); renderPending(data.pendingActions);
      history.push({ role: 'assistant', content: data.answer }); while (history.length > 12) history.shift(); await refreshStatus();
    } catch (error) { typing.remove(); addMessage('assistant', error.message || 'Không kết nối được trợ lý AI.', 'error'); history.pop(); }
    finally { busy = false; sendButton.disabled = false; input.focus(); scrollBottom(); }
  }
  const quickPrompts = ['Tình trạng ngôi nhà', 'Nhiệt độ hiện tại', 'Bật quạt', 'Tắt tất cả đèn', 'Kiểm tra cảnh báo cháy', 'Thiết bị nào đang bật?', 'Bật chế độ đi ngủ'];
  const quick = panel.querySelector('.smart-ai-quick');
  quickPrompts.forEach((text) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.addEventListener('click', () => send(text)); quick.appendChild(button); });
  addMessage('assistant', 'Xin chào! Tôi có thể đọc cảm biến thật, kiểm tra trạng thái, điều khiển thiết bị qua ESP32 và tạo automation có xác nhận.');
  function togglePanel(open) { panel.classList.toggle('open', open); launcher.setAttribute('aria-expanded', String(open)); if (open) { input.focus(); refreshStatus(); } }
  launcher.addEventListener('click', () => togglePanel(!panel.classList.contains('open')));
  panel.querySelector('.smart-ai-close').addEventListener('click', () => togglePanel(false));
  panel.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); send(input.value.trim()); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(input.value.trim()); } });
  refreshStatus(); setInterval(refreshStatus, 15000);
})();
