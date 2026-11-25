const test = require('node:test');
const assert = require('node:assert/strict');
const { getDevices, resolveDevice, normalizeText } = require('../config/deviceRegistry');

test('chuẩn hóa tên thiết bị tiếng Việt', () => {
  assert.equal(normalizeText('Điều hòa'), 'dieu hoa');
  assert.equal(resolveDevice('máy lạnh').device.id, 'ac');
  assert.equal(resolveDevice('quạt').device.id, 'fan');
});

test('không tự gán phòng khi chưa có cấu hình', () => {
  assert.equal(getDevices().every((device) => device.room === null), true);
  assert.equal(resolveDevice('đèn phòng khách').device, null);
});

test('cho phép ánh xạ phòng đã được người dùng xác nhận qua biến môi trường', () => {
  const previous = process.env.DEVICE_LABELS_JSON;
  process.env.DEVICE_LABELS_JSON = JSON.stringify({ led1: { label: 'Đèn phòng khách', room: 'phòng khách', aliases: ['đèn khách'] } });
  try {
    assert.equal(resolveDevice('đèn khách', 'phòng khách').device.id, 'led1');
  } finally {
    if (previous === undefined) delete process.env.DEVICE_LABELS_JSON;
    else process.env.DEVICE_LABELS_JSON = previous;
  }
});
