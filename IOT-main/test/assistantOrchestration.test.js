const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MQTT_HOST = '127.0.0.1';
process.env.MQTT_PORT = '1';
process.env.MQTT_USERNAME = 'test';
process.env.MQTT_PASSWORD = 'test';

const assistantService = require('../ai/assistantService');
const mqttService = require('../services/mqttService');

test.after(() => mqttService.client.end(true));

test('orchestrator gọi tool rồi đưa kết quả lại cho model', async () => {
  let round = 0;
  let receivedToolResult = false;
  const provider = {
    model: 'fake-tool-model',
    async chat({ messages }) {
      round += 1;
      if (round === 1) return { model: this.model, message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'get_sensor_data', arguments: {} } }] } };
      receivedToolResult = messages.some((message) => message.role === 'tool' && message.content.includes('31.5'));
      return { model: this.model, message: { role: 'assistant', content: 'Nhiệt độ hiện tại là 31,5 °C.' } };
    }
  };
  const result = await assistantService.chat(
    [{ role: 'user', content: 'Nhiệt độ hiện tại?' }],
    '507f1f77bcf86cd799439011',
    { provider, executeTool: async () => ({ sample: { temperature: 31.5 }, freshness: { fresh: true } }) }
  );
  assert.equal(receivedToolResult, true);
  assert.equal(result.answer, 'Nhiệt độ hiện tại là 31,5 °C.');
  assert.equal(result.toolResults.length, 1);
});

test('orchestrator không thực thi automation trước bước xác nhận', async () => {
  let round = 0;
  let executed = false;
  const provider = {
    model: 'fake-tool-model',
    async chat() {
      round += 1;
      if (round === 1) return {
        model: this.model,
        message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'create_automation_rule', arguments: {
          name: 'Bật quạt khi nóng', trigger: { type: 'sensor', metric: 'temperature', operator: 'gt', value: 30 },
          actions: [{ type: 'device', device: 'fan', power: true }]
        } } }] }
      };
      return { model: this.model, message: { role: 'assistant', content: 'Hãy xác nhận quy tắc.' } };
    }
  };
  const result = await assistantService.chat(
    [{ role: 'user', content: 'Nếu trên 30 độ thì bật quạt.' }],
    '507f1f77bcf86cd799439011',
    {
      provider,
      executeTool: async () => { executed = true; },
      createPendingAction: async () => ({ id: 'pending-1', toolName: 'create_automation_rule', summary: 'Tạo quy tắc.' })
    }
  );
  assert.equal(executed, false);
  assert.equal(result.pendingActions.length, 1);
  assert.equal(result.answer, 'Hãy xác nhận quy tắc.');
});
