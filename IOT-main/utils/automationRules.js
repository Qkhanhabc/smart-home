const ALLOWED_METRICS = new Set(['temperature', 'humidity', 'light', 'mq2', 'person', 'smokeAlarm']);
const ALLOWED_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']);
const ALLOWED_DEVICES = new Set(['fan', 'ac', 'led1', 'led2', 'led3']);

function compare(actual, operator, expected) {
  if (actual === null || actual === undefined) return false;
  switch (operator) {
    case 'gt': return Number(actual) > Number(expected);
    case 'gte': return Number(actual) >= Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
    case 'eq': return actual === expected || String(actual) === String(expected);
    case 'neq': return !(actual === expected || String(actual) === String(expected));
    default: return false;
  }
}

function conditionMatches(condition, sensor) {
  return Boolean(condition && ALLOWED_METRICS.has(condition.metric) && ALLOWED_OPERATORS.has(condition.operator)
    && compare(sensor?.[condition.metric], condition.operator, condition.value));
}

function ruleMatchesSensor(rule, sensor) {
  const trigger = rule?.trigger;
  if (!trigger || trigger.type !== 'sensor') return false;
  if (!conditionMatches(trigger, sensor)) return false;
  return (rule.conditions || []).every((condition) => conditionMatches(condition, sensor));
}

function validateAction(action) {
  if (!action || !['device', 'air_conditioner', 'scene'].includes(action.type)) return 'Loại hành động không hợp lệ.';
  if (action.type === 'scene') return typeof action.scene === 'string' && action.scene.trim() ? null : 'Thiếu tên kịch bản.';
  if (action.type === 'air_conditioner') {
    if (action.device !== undefined && action.device !== 'ac') return 'Hành động air_conditioner chỉ áp dụng cho thiết bị ac.';
    if (action.power === undefined && action.mode === undefined && action.temp === undefined && action.fan === undefined) return 'Hành động air_conditioner cần power, mode, temp hoặc fan.';
  } else if (!ALLOWED_DEVICES.has(action.device)) return 'Thiết bị không hợp lệ.';
  if (action.power !== undefined && typeof action.power !== 'boolean') return 'power phải là true hoặc false.';
  if (action.type === 'device' && action.power === undefined) return 'Hành động thiết bị cần power.';
  if (action.temp !== undefined && (!Number.isInteger(Number(action.temp)) || Number(action.temp) < 16 || Number(action.temp) > 30)) return 'Nhiệt độ điều hòa phải từ 16 đến 30 °C.';
  if (action.mode !== undefined && !['auto', 'cool', 'dry', 'fan'].includes(action.mode)) return 'Chế độ điều hòa không hợp lệ.';
  if (action.fan !== undefined && !['auto', 'low', 'medium', 'high'].includes(action.fan)) return 'Tốc độ quạt điều hòa không hợp lệ.';
  return null;
}

function validateRuleInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Quy tắc phải là một object.';
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) return 'Tên quy tắc không hợp lệ.';
  }
  if (!partial || input.trigger !== undefined) {
    const trigger = input.trigger;
    if (!trigger || !['sensor', 'time'].includes(trigger.type)) return 'Trigger phải là sensor hoặc time.';
    if (trigger.type === 'sensor') {
      if (!ALLOWED_METRICS.has(trigger.metric) || !ALLOWED_OPERATORS.has(trigger.operator)) return 'Điều kiện cảm biến không hợp lệ.';
      if (trigger.value === undefined) return 'Thiếu giá trị trigger.';
      if (trigger.durationSeconds !== undefined && (!Number.isFinite(Number(trigger.durationSeconds)) || Number(trigger.durationSeconds) < 0 || Number(trigger.durationSeconds) > 86400)) return 'durationSeconds không hợp lệ.';
    }
    if (trigger.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(trigger.time || ''))) return 'Giờ chạy phải có dạng HH:mm.';
  }
  if (!partial || input.actions !== undefined) {
    if (!Array.isArray(input.actions) || input.actions.length < 1 || input.actions.length > 10) return 'Quy tắc cần từ 1 đến 10 hành động.';
    for (const action of input.actions) {
      const error = validateAction(action);
      if (error) return error;
    }
  }
  if (input.conditions !== undefined) {
    if (!Array.isArray(input.conditions) || input.conditions.length > 10) return 'conditions không hợp lệ.';
    if (input.conditions.some((condition) => !ALLOWED_METRICS.has(condition.metric) || !ALLOWED_OPERATORS.has(condition.operator) || condition.value === undefined)) return 'Điều kiện bổ sung không hợp lệ.';
  }
  return null;
}

module.exports = { compare, conditionMatches, ruleMatchesSensor, validateAction, validateRuleInput };
