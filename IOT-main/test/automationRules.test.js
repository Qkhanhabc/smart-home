const test = require('node:test');
const assert = require('node:assert/strict');
const { compare, ruleMatchesSensor, validateAction, validateRuleInput } = require('../utils/automationRules');

test('so sánh điều kiện cảm biến', () => {
  assert.equal(compare(31, 'gt', 30), true);
  assert.equal(compare(26, 'lte', 26), true);
  assert.equal(compare(true, 'eq', true), true);
  assert.equal(compare(null, 'gt', 0), false);
});

test('quy tắc chỉ khớp khi trigger và mọi condition đều đúng', () => {
  const rule = {
    trigger: { type: 'sensor', metric: 'temperature', operator: 'gte', value: 30 },
    conditions: [{ metric: 'person', operator: 'eq', value: true }]
  };
  assert.equal(ruleMatchesSensor(rule, { temperature: 31, person: true }), true);
  assert.equal(ruleMatchesSensor(rule, { temperature: 31, person: false }), false);
});

test('từ chối thiết bị và nhiệt độ điều hòa không hợp lệ', () => {
  assert.match(validateAction({ type: 'device', device: 'heater', power: true }), /Thiết bị/);
  assert.match(validateAction({ type: 'air_conditioner', device: 'ac', temp: 35 }), /16 đến 30/);
  assert.match(validateAction({ type: 'air_conditioner', device: 'fan', power: true }), /chỉ áp dụng/);
  assert.match(validateAction({ type: 'air_conditioner', device: 'ac' }), /cần power/);
});

test('xác thực cấu trúc automation do AI tạo', () => {
  const valid = {
    name: 'Bật quạt khi nóng và có người',
    trigger: { type: 'sensor', metric: 'temperature', operator: 'gt', value: 30 },
    conditions: [{ metric: 'person', operator: 'eq', value: true }],
    actions: [{ type: 'device', device: 'fan', power: true }],
    cooldownSeconds: 60
  };
  assert.equal(validateRuleInput(valid), null);
  assert.match(validateRuleInput({ ...valid, actions: [] }), /1 đến 10/);
});
