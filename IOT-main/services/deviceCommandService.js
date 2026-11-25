const crypto = require('crypto');
const mqttService = require('./mqttService');
const topics = require('../config/mqttTopics');
const { getDeviceById, resolveDevice } = require('../config/deviceRegistry');
const { shouldBlockAutomaticFan } = require('../utils/safetyPolicy');

const pendingBySignature = new Map();

function normalizePower(value) {
  if (value === true || value === 1 || String(value).toLowerCase() === 'on') return true;
  if (value === false || value === 0 || String(value).toLowerCase() === 'off') return false;
  throw new Error('Trạng thái power phải là true/false hoặc on/off.');
}

function assertAvailable() {
  if (!mqttService.client.connected) {
    const error = new Error('Backend chưa kết nối MQTT broker.');
    error.code = 'MQTT_OFFLINE';
    throw error;
  }
  if (!mqttService.isDeviceOnline()) {
    const error = new Error('ESP32 đang offline hoặc đã quá lâu không gửi heartbeat.');
    error.code = 'ESP32_OFFLINE';
    throw error;
  }
}

function safetyCheck(deviceId, power, source) {
  const sensor = mqttService.getLatestSensorData();
  if (shouldBlockAutomaticFan({ deviceId, power, source, sensor })) {
    const error = new Error('Không bật quạt tự động khi cảm biến đang cảnh báo khói/khí gas. Hãy kiểm tra khu vực và thông gió theo hướng dẫn an toàn.');
    error.code = 'SAFETY_BLOCK';
    throw error;
  }
}

function publish(topic, payload) {
  return new Promise((resolve, reject) => {
    mqttService.client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function waitForState(eventName, predicate, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      mqttService.off(eventName, listener);
      resolve(value);
    };
    const listener = (state) => {
      if (predicate(state)) finish(state);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    mqttService.on(eventName, listener);
  });
}

async function controlDevice({ device, room, power }, options = {}) {
  const source = options.source || 'dashboard';
  const resolved = getDeviceById(device) || resolveDevice(device, room).device;
  if (!resolved) {
    const error = new Error(room
      ? `Không tìm thấy thiết bị “${device}” trong phòng “${room}”. Hãy dùng đúng tên thiết bị đã cấu hình.`
      : `Không tìm thấy thiết bị “${device}”.`);
    error.code = 'UNKNOWN_DEVICE';
    throw error;
  }
  const target = normalizePower(power);
  if (resolved.id === 'ac') return controlAirConditioner({ power: target }, options);
  assertAvailable();
  safetyCheck(resolved.id, target, source);

  const targetText = target ? 'ON' : 'OFF';
  const current = mqttService.getCurrentDeviceStatus()[resolved.stateKey];
  if (current === targetText) {
    return {
      ok: true,
      device: resolved.id,
      label: resolved.label,
      requestedState: targetText,
      status: 'already_in_state',
      confirmation: 'reported_by_esp32',
      esp32Reported: true,
      physicallyVerified: false
    };
  }

  const signature = `${resolved.id}:${targetText}`;
  if (pendingBySignature.has(signature)) return pendingBySignature.get(signature);

  const commandId = crypto.randomUUID();
  const operation = (async () => {
    const wait = waitForState('deviceStatusUpdate', (state) => state[resolved.stateKey] === targetText, options.timeoutMs || 5000);
    mqttService.markDesiredState(resolved.id, targetText, { source, commandId, verification: 'reported_by_esp32' });
    await publish(topics.deviceCommand, { device: resolved.id, power: target ? 1 : 0, command_id: commandId });
    const acknowledged = await wait;
    return {
      ok: Boolean(acknowledged),
      device: resolved.id,
      label: resolved.label,
      commandId,
      requestedState: targetText,
      status: acknowledged ? 'acknowledged' : 'sent_unconfirmed',
      confirmation: acknowledged ? 'reported_by_esp32' : 'unconfirmed',
      esp32Reported: Boolean(acknowledged),
      physicallyVerified: false,
      message: acknowledged
        ? `ESP32 đã báo ${resolved.label} ở trạng thái ${targetText}.`
        : `Đã gửi lệnh ${targetText} cho ${resolved.label} nhưng chưa nhận được trạng thái phản hồi.`
    };
  })().finally(() => pendingBySignature.delete(signature));
  pendingBySignature.set(signature, operation);
  return operation;
}

async function controlAirConditioner(command, options = {}) {
  assertAvailable();
  const source = options.source || 'dashboard';
  command = Object.fromEntries(Object.entries(command || {}).filter(([, value]) => value !== undefined));
  const allowed = new Set(['power', 'mode', 'temp', 'fan', 'slot']);
  if (!command || !Object.keys(command).length || Object.keys(command).some((key) => !allowed.has(key))) {
    throw new Error('Lệnh điều hòa không hợp lệ.');
  }
  const payload = {};
  if (command.power !== undefined) payload.power = normalizePower(command.power) ? 1 : 0;
  if (command.mode !== undefined) {
    if (!['auto', 'cool', 'dry', 'fan'].includes(command.mode)) throw new Error('Chế độ điều hòa không hợp lệ.');
    payload.mode = command.mode;
  }
  if (command.temp !== undefined) {
    const temp = Number(command.temp);
    if (!Number.isInteger(temp) || temp < 16 || temp > 30) throw new Error('Nhiệt độ điều hòa phải từ 16 đến 30 °C.');
    payload.temp = temp;
  }
  if (command.fan !== undefined) {
    if (!['auto', 'low', 'medium', 'high'].includes(command.fan)) throw new Error('Tốc độ quạt điều hòa không hợp lệ.');
    payload.fan = command.fan;
  }
  if (command.slot !== undefined) {
    if (typeof command.slot !== 'string' || !/^[a-zA-Z0-9_-]{1,16}$/.test(command.slot)) throw new Error('Raw slot không hợp lệ.');
    payload.slot = command.slot;
  }

  const commandId = crypto.randomUUID();
  const expectedPower = payload.power === undefined ? null : payload.power ? 'ON' : 'OFF';
  const wait = waitForState('acStateUpdate', (state) => {
    if (state?.error) return true;
    if (expectedPower && String(state?.power ? 'ON' : 'OFF') !== expectedPower) return false;
    if (payload.temp !== undefined && Number(state?.temp) !== payload.temp) return false;
    return Boolean(state && (Object.prototype.hasOwnProperty.call(state, 'power') || state.raw_slot || state.error));
  }, options.timeoutMs || 6000);
  if (expectedPower) mqttService.markDesiredState('ac', expectedPower, { source, commandId, verification: 'ir_command_only' });
  await publish(topics.acCommand, { ...payload, command_id: commandId });
  const response = await wait;
  const control = response?.control || mqttService.getCurrentAcState()?.control || 'none';
  const rejected = response?.error;
  return {
    ok: Boolean(response) && !rejected,
    device: 'ac',
    label: 'Điều hòa',
    commandId,
    command: payload,
    status: rejected ? 'rejected_by_esp32' : response ? 'esp32_reported_command' : 'sent_unconfirmed',
    confirmation: 'ir_command_only',
    physicallyVerified: false,
    controlMode: control,
    response: response || null,
    message: rejected
      ? `ESP32 từ chối lệnh điều hòa: ${rejected}.`
      : response
        ? 'ESP32 đã xử lý lệnh IR. Không có cảm biến phản hồi từ máy lạnh nên chưa thể xác minh thiết bị vật lý đã thay đổi.'
        : 'Đã gửi lệnh IR nhưng chưa nhận được phản hồi từ ESP32; chưa thể xác minh máy lạnh.'
  };
}

async function controlMultiple(commands, options = {}) {
  if (!Array.isArray(commands) || commands.length < 1 || commands.length > 10) throw new Error('Danh sách lệnh phải có từ 1 đến 10 phần tử.');
  const results = [];
  for (const command of commands) {
    try {
      results.push(command.device === 'ac'
        ? await controlAirConditioner({ power: command.power, mode: command.mode, temp: command.temp, fan: command.fan, slot: command.slot }, options)
        : await controlDevice(command, options));
    } catch (error) {
      results.push({ ok: false, device: command.device, error: error.message, code: error.code });
    }
  }
  return { ok: results.every((item) => item.ok), results };
}

module.exports = { controlDevice, controlAirConditioner, controlMultiple, normalizePower };
