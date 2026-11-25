const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldBlockAutomaticFan } = require('../utils/safetyPolicy');

test('chặn AI và automation bật quạt khi có cảnh báo khói', () => {
  for (const source of ['ai', 'automation', 'schedule', 'scene']) {
    assert.equal(shouldBlockAutomaticFan({ deviceId: 'fan', power: true, source, sensor: { smokeAlarm: true } }), true);
  }
});

test('không chặn lệnh tắt hoặc thiết bị không phải quạt', () => {
  assert.equal(shouldBlockAutomaticFan({ deviceId: 'fan', power: false, source: 'ai', sensor: { smokeAlarm: true } }), false);
  assert.equal(shouldBlockAutomaticFan({ deviceId: 'led1', power: true, source: 'ai', sensor: { smokeAlarm: true } }), false);
});
