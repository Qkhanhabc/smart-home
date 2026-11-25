const test = require('node:test');
const assert = require('node:assert/strict');
const { tools, asProviderTools } = require('../ai/toolDefinitions');

test('tên tool là duy nhất và schema được chuyển đúng định dạng Ollama', () => {
  const names = tools.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length);
  const providerTools = asProviderTools();
  assert.equal(providerTools.length, tools.length);
  assert.equal(providerTools.every((tool) => tool.type === 'function' && tool.function.parameters), true);
});

test('các hành động dài hạn cần bước xác nhận', () => {
  for (const name of ['create_automation_rule', 'update_automation_rule', 'delete_automation_rule', 'schedule_device_action', 'activate_scene']) {
    assert.equal(tools.find((tool) => tool.name === name)?.confirmationRequired, true, name);
  }
  assert.equal(tools.find((tool) => tool.name === 'control_device')?.confirmationRequired, undefined);
});
