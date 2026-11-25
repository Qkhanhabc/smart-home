const SensorData = require('../models/SensorData');
const AnomalyEvent = require('../models/AnomalyEvent');
const ActionData = require('../models/ActionData');
const AutomationRule = require('../models/AutomationRule');
const ScheduledAction = require('../models/ScheduledAction');
const mqttService = require('../services/mqttService');
const deviceCommands = require('../services/deviceCommandService');
const sceneService = require('../services/sceneService');
const { getDevices, getDeviceById, resolveDevice } = require('../config/deviceRegistry');
const { validateRuleInput, validateAction } = require('../utils/automationRules');

function requireObject(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tham số tool phải là object.');
}

function sensorEnvelope() {
  const status = mqttService.getSystemStatus();
  return { sample: mqttService.getLatestSensorData(), freshness: { fresh: status.sensorFresh, ageSeconds: status.sensorAgeSeconds, lastSensorAt: status.lastSensorAt }, esp32Online: status.esp32Online };
}

async function executeTool(name, args = {}, context = {}) {
  requireObject(args);
  switch (name) {
    case 'get_system_status':
      return {
        ...mqttService.getSystemStatus(),
        reportedDeviceStates: mqttService.getCurrentDeviceStatus(),
        desiredDeviceStates: mqttService.getDesiredDeviceStatus(),
        acState: mqttService.getCurrentAcState(),
        devices: getDevices()
      };
    case 'get_sensor_data':
      return sensorEnvelope();
    case 'get_fire_status': {
      const data = sensorEnvelope();
      return {
        ...data,
        fireSensorInstalled: false,
        localAlarmIndependentOfAI: true,
        note: 'Source code chỉ xác nhận MQ-2, nhiệt độ, còi và LED cảnh báo; không có cảm biến ngọn lửa trong firmware hiện tại.'
      };
    }
    case 'get_device_status': {
      const states = mqttService.getCurrentDeviceStatus();
      if (!args.device) return { states, desired: mqttService.getDesiredDeviceStatus(), devices: getDevices(), system: mqttService.getSystemStatus() };
      const device = getDeviceById(args.device) || resolveDevice(args.device).device;
      if (!device) throw new Error(`Không tìm thấy thiết bị “${args.device}”.`);
      return { device, reportedState: states[device.stateKey], desiredState: mqttService.getDesiredDeviceStatus()[device.stateKey], system: mqttService.getSystemStatus(), acState: device.id === 'ac' ? mqttService.getCurrentAcState() : undefined };
    }
    case 'get_sensor_history': {
      const metric = args.metric;
      if (!['temperature', 'humidity', 'light', 'mq2'].includes(metric)) throw new Error('Metric lịch sử không hợp lệ.');
      const hours = Math.min(720, Math.max(1, Number(args.hours || 24)));
      const since = new Date(Date.now() - hours * 3600000);
      const rows = await SensorData.find({ createdAt: { $gte: since }, [metric]: { $ne: null } }).sort({ createdAt: 1 }).select(`${metric} createdAt -_id`).lean();
      const values = rows.map((row) => ({ value: Number(row[metric]), createdAt: row.createdAt })).filter((item) => Number.isFinite(item.value));
      if (!values.length) return { metric, hours, samples: 0, message: 'Không có dữ liệu trong khoảng thời gian này.' };
      const min = values.reduce((a, b) => b.value < a.value ? b : a);
      const max = values.reduce((a, b) => b.value > a.value ? b : a);
      const average = values.reduce((sum, item) => sum + item.value, 0) / values.length;
      return { metric, hours, samples: values.length, average: Number(average.toFixed(2)), min, max, from: values[0].createdAt, to: values.at(-1).createdAt };
    }
    case 'get_alert_history': {
      const limit = Math.min(20, Math.max(1, Number(args.limit || 10)));
      const events = await AnomalyEvent.find().sort({ lastSeenAt: -1 }).limit(limit).lean();
      return { events };
    }
    case 'get_device_history': {
      const hours = Math.min(720, Math.max(1, Number(args.hours || 24)));
      const since = new Date(Date.now() - hours * 3600000);
      const filter = { time: { $gte: since } };
      if (args.device) {
        const device = getDeviceById(args.device) || resolveDevice(args.device).device;
        if (!device) throw new Error(`Không tìm thấy thiết bị “${args.device}”.`);
        filter.$or = [{ deviceId: device.id }, { device: device.label.toLowerCase() }];
      }
      const events = await ActionData.find(filter).sort({ time: -1 }).limit(200).lean();
      return { hours, events, note: 'Không có đồng hồ đo điện; lịch sử chỉ phản ánh các lần thay đổi trạng thái đã ghi nhận.' };
    }
    case 'control_device':
      return deviceCommands.controlDevice(args, { source: 'ai', userId: context.userId });
    case 'control_multiple_devices':
      return deviceCommands.controlMultiple(args.commands, { source: 'ai', userId: context.userId });
    case 'set_air_conditioner':
      return deviceCommands.controlAirConditioner(args, { source: 'ai', userId: context.userId });
    case 'list_automation_rules': {
      const rules = await AutomationRule.find({ userId: context.userId }).sort({ createdAt: -1 }).lean();
      return { rules };
    }
    case 'create_automation_rule': {
      const error = validateRuleInput(args);
      if (error) throw new Error(error);
      const rule = await AutomationRule.create({ ...args, userId: context.userId });
      return { created: true, rule };
    }
    case 'update_automation_rule': {
      const error = validateRuleInput(args.changes, { partial: true });
      if (error) throw new Error(error);
      const allowed = ['name', 'enabled', 'trigger', 'conditions', 'actions', 'cooldownSeconds', 'priority'];
      const changes = Object.fromEntries(Object.entries(args.changes || {}).filter(([key]) => allowed.includes(key)));
      const rule = await AutomationRule.findOneAndUpdate({ _id: args.id, userId: context.userId }, { ...changes, updatedAt: new Date() }, { new: true, runValidators: true });
      if (!rule) throw new Error('Không tìm thấy quy tắc cần cập nhật.');
      return { updated: true, rule };
    }
    case 'delete_automation_rule': {
      const rule = await AutomationRule.findOneAndDelete({ _id: args.id, userId: context.userId });
      if (!rule) throw new Error('Không tìm thấy quy tắc cần xóa.');
      return { deleted: true, id: rule._id, name: rule.name };
    }
    case 'schedule_device_action': {
      const actionError = validateAction(args.action);
      if (actionError) throw new Error(actionError);
      let executeAt;
      if (args.delay_minutes !== undefined) executeAt = new Date(Date.now() + Number(args.delay_minutes) * 60000);
      else executeAt = new Date(args.execute_at);
      if (!Number.isFinite(executeAt.getTime()) || executeAt <= new Date()) throw new Error('Thời điểm hẹn phải ở tương lai.');
      const item = await ScheduledAction.create({ userId: context.userId, description: String(args.description || 'Tác vụ từ trợ lý').slice(0, 200), executeAt, action: args.action });
      return { scheduled: true, item };
    }
    case 'activate_scene':
      return sceneService.activateScene(args.scene, { source: 'scene', userId: context.userId });
    default:
      throw new Error(`Tool “${name}” không được cấp quyền.`);
  }
}

function confirmationSummary(name, args) {
  if (name === 'create_automation_rule') return `Tạo quy tắc “${args.name}”.`;
  if (name === 'update_automation_rule') return `Cập nhật quy tắc ${args.id}.`;
  if (name === 'delete_automation_rule') return `Xóa quy tắc ${args.id}.`;
  if (name === 'schedule_device_action') return `Hẹn “${args.description || 'hành động thiết bị'}” vào ${args.execute_at || `sau ${args.delay_minutes} phút`}.`;
  if (name === 'activate_scene') return `Kích hoạt kịch bản “${args.scene}”.`;
  return `Thực hiện ${name}.`;
}

function validatePendingToolArguments(name, args) {
  requireObject(args);
  if (name === 'create_automation_rule') return validateRuleInput(args);
  if (name === 'update_automation_rule') {
    if (!/^[a-f0-9]{24}$/i.test(String(args.id || ''))) return 'ID quy tắc không hợp lệ.';
    return validateRuleInput(args.changes, { partial: true });
  }
  if (name === 'delete_automation_rule') return /^[a-f0-9]{24}$/i.test(String(args.id || '')) ? null : 'ID quy tắc không hợp lệ.';
  if (name === 'schedule_device_action') {
    const actionError = validateAction(args.action);
    if (actionError) return actionError;
    if (args.delay_minutes === undefined && args.execute_at === undefined) return 'Thiếu thời điểm hẹn.';
    if (args.delay_minutes !== undefined && (!Number.isFinite(Number(args.delay_minutes)) || Number(args.delay_minutes) < 0.1 || Number(args.delay_minutes) > 43200)) return 'delay_minutes không hợp lệ.';
    if (args.execute_at !== undefined && (!Number.isFinite(new Date(args.execute_at).getTime()) || new Date(args.execute_at) <= new Date())) return 'execute_at phải là thời điểm hợp lệ trong tương lai.';
    return null;
  }
  if (name === 'activate_scene') return typeof args.scene === 'string' && args.scene.trim() ? null : 'Thiếu tên kịch bản.';
  return null;
}

module.exports = { executeTool, confirmationSummary, validatePendingToolArguments };
