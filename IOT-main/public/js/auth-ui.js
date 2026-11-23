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
    #local-assistant-launcher{position:fixed;right:22px;bottom:22px;z-index:1080;border:0;border-radius:999px;padding:13px 18px;background:#1455b8;color:#fff;box-shadow:0 8px 24px #0b1c3840;font-weight:600}
    #local-assistant-panel{position:fixed;right:22px;bottom:82px;z-index:1080;width:min(390px,calc(100vw - 28px));height:min(570px,calc(100vh - 110px));background:#fff;border-radius:16px;box-shadow:0 14px 48px #11182740;display:none;flex-direction:column;overflow:hidden;border:1px solid #dfe4eb}
    #local-assistant-panel.open{display:flex}.local-assistant-head{padding:14px 16px;background:#102d54;color:#fff;display:flex;align-items:center;justify-content:space-between}.local-assistant-head small{display:block;color:#c5d5ec}.local-assistant-head button{border:0;background:transparent;color:white;font-size:1.2rem}
    #local-assistant-messages{flex:1;overflow:auto;padding:14px;background:#f5f7fa;display:flex;flex-direction:column;gap:10px}.local-assistant-msg{white-space:pre-wrap;overflow-wrap:anywhere;max-width:88%;padding:10px 12px;border-radius:13px;font-size:.92rem;line-height:1.45}.local-assistant-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #e4e8ee}.local-assistant-msg.user{align-self:flex-end;background:#dbeafe;color:#12305a}.local-assistant-foot{padding:11px;border-top:1px solid #e8ebf0}.local-assistant-foot form{display:flex;gap:8px}.local-assistant-foot textarea{resize:none;min-height:44px;max-height:100px}.local-assistant-foot button{align-self:flex-end;height:44px}.local-assistant-note{font-size:.72rem;color:#697586;margin-top:7px}
    @media(max-width:520px){#local-assistant-panel{right:10px;bottom:74px;height:min(72vh,570px)}#local-assistant-launcher{right:12px;bottom:12px}}
  `;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.id = 'local-assistant-launcher';
  launcher.type = 'button';
  launcher.textContent = '✦ Trợ lý nhà thông minh';
  launcher.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('section');
  panel.id = 'local-assistant-panel';
  panel.setAttribute('aria-label', 'Trợ lý nhà thông minh');
  panel.innerHTML = `
    <header class="local-assistant-head"><div><strong>Trợ lý nhà thông minh</strong><small>Chạy cục bộ trên máy backend</small></div><button type="button" id="local-assistant-close" aria-label="Đóng">×</button></header>
    <div id="local-assistant-messages" aria-live="polite"></div>
    <div class="local-assistant-foot"><form id="local-assistant-form"><textarea id="local-assistant-input" class="form-control" maxlength="1200" placeholder="Hỏi về cảm biến, bất thường, trạng thái…" aria-label="Nhập câu hỏi"></textarea><button class="btn btn-primary" type="submit" aria-label="Gửi câu hỏi"><i class="fa-solid fa-paper-plane"></i></button></form><div class="local-assistant-note">Chỉ đọc dữ liệu hệ thống, không điều khiển thiết bị. Hội thoại chỉ giữ trong tab này.</div></div>`;
  document.body.append(launcher, panel);

  const history = [];
  const messages = panel.querySelector('#local-assistant-messages');
  const input = panel.querySelector('#local-assistant-input');
  let busy = false;

  function addMessage(role, content) {
    const bubble = document.createElement('div');
    bubble.className = `local-assistant-msg ${role}`;
    bubble.textContent = content;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  addMessage('assistant', 'Xin chào! Bạn có thể hỏi về số đo cảm biến gần nhất, xu hướng trong các mẫu đã lưu hoặc các bất thường được phát hiện.');

  function togglePanel(open) {
    panel.classList.toggle('open', open);
    launcher.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  }
  launcher.addEventListener('click', () => togglePanel(!panel.classList.contains('open')));
  panel.querySelector('#local-assistant-close').addEventListener('click', () => togglePanel(false));

  panel.querySelector('#local-assistant-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    input.value = '';
    history.push({ role: 'user', content: text });
    addMessage('user', text);
    const pending = addMessage('assistant', 'Đang hỏi mô hình local…');
    panel.querySelector('button[type="submit"]').disabled = true;
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Không nhận được câu trả lời.');
      pending.textContent = data.answer;
      history.push({ role: 'assistant', content: data.answer });
      while (history.length > 10) history.shift();
    } catch (error) {
      pending.textContent = error.message || 'Không kết nối được mô hình local.';
      pending.classList.add('text-danger');
      history.pop();
    } finally {
      busy = false;
      panel.querySelector('button[type="submit"]').disabled = false;
      messages.scrollTop = messages.scrollHeight;
      input.focus();
    }
  });
})();
