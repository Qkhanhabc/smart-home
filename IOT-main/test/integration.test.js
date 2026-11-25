const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.RUN_INTEGRATION_TESTS === '1';
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

test('backend trả trang đăng nhập', { skip: !enabled }, async () => {
  const response = await fetch(`${baseUrl}/login.html`);
  assert.equal(response.ok, true);
});

test('API riêng tư từ chối yêu cầu không có phiên', { skip: !enabled }, async () => {
  const response = await fetch(`${baseUrl}/api/assistant/status`, { redirect: 'manual' });
  assert.equal(response.status, 401);
});
