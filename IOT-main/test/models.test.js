const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AutomationRule = require('../models/AutomationRule');
const PendingAiAction = require('../models/PendingAiAction');

test('AutomationRule hợp lệ qua Mongoose schema', () => {
  const rule = new AutomationRule({
    userId: new mongoose.Types.ObjectId(), name: 'Bật quạt khi nóng',
    trigger: { type: 'sensor', metric: 'temperature', operator: 'gt', value: 30 },
    actions: [{ type: 'device', device: 'fan', power: true }]
  });
  assert.equal(rule.validateSync(), undefined);
});

test('AutomationRule từ chối thiết bị ngoài allowlist', () => {
  const rule = new AutomationRule({
    userId: new mongoose.Types.ObjectId(), name: 'Sai',
    trigger: { type: 'sensor', metric: 'temperature', operator: 'gt', value: 30 },
    actions: [{ type: 'device', device: 'heater', power: true }]
  });
  assert.ok(rule.validateSync());
});

test('PendingAiAction hỗ trợ trạng thái claim nguyên tử running', () => {
  const item = new PendingAiAction({
    userId: new mongoose.Types.ObjectId(), toolName: 'activate_scene', arguments: { scene: 'sleep' },
    summary: 'Bật chế độ ngủ', status: 'running', expiresAt: new Date(Date.now() + 60000)
  });
  assert.equal(item.validateSync(), undefined);
});
