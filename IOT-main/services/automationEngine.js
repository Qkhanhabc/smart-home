const AutomationRule = require('../models/AutomationRule');
const ScheduledAction = require('../models/ScheduledAction');
const deviceCommands = require('./deviceCommandService');
const sceneService = require('./sceneService');
const { ruleMatchesSensor } = require('../utils/automationRules');

const matchedSince = new Map();
let started = false;
let ioInstance = null;

function actionKey(action) {
  if (action.type === 'scene') return `scene:${action.scene}`;
  return `device:${action.device}`;
}

async function executeAction(action, options = {}) {
  if (action.type === 'scene') return sceneService.activateScene(action.scene, options);
  if (action.type === 'air_conditioner' || action.device === 'ac') {
    return deviceCommands.controlAirConditioner({ power: action.power, mode: action.mode, temp: action.temp, fan: action.fan, slot: action.slot }, { ...options, source: options.source || 'automation' });
  }
  return deviceCommands.controlDevice(action, { ...options, source: options.source || 'automation' });
}

async function executeRule(rule, occupiedActions) {
  const results = [];
  for (const action of rule.actions) {
    const key = actionKey(action);
    if (occupiedActions.has(key)) {
      results.push({ ok: false, skipped: true, reason: 'conflict_with_higher_priority_rule', action: key });
      continue;
    }
    occupiedActions.add(key);
    try {
      results.push(await executeAction(action.toObject ? action.toObject() : action, { source: 'automation' }));
    } catch (error) {
      results.push({ ok: false, error: error.message, code: error.code, action: key });
    }
  }
  rule.lastTriggeredAt = new Date();
  rule.lastResult = results;
  rule.updatedAt = new Date();
  await rule.save();
  const event = { ruleId: rule._id, name: rule.name, results, createdAt: rule.lastTriggeredAt };
  if (ioInstance) ioInstance.emit('automationAction', event);
  return event;
}

async function evaluateSensorRules(sensor) {
  const rules = await AutomationRule.find({ enabled: true, 'trigger.type': 'sensor' }).sort({ priority: -1, createdAt: 1 });
  const now = Date.now();
  const ready = [];
  for (const rule of rules) {
    const id = String(rule._id);
    if (!ruleMatchesSensor(rule, sensor)) {
      matchedSince.delete(id);
      continue;
    }
    if (!matchedSince.has(id)) matchedSince.set(id, now);
    const durationMs = Number(rule.trigger.durationSeconds || 0) * 1000;
    if (now - matchedSince.get(id) < durationMs) continue;
    const cooldownMs = Number(rule.cooldownSeconds || 60) * 1000;
    if (rule.lastTriggeredAt && now - rule.lastTriggeredAt.getTime() < cooldownMs) continue;
    ready.push(rule);
  }
  const occupied = new Set();
  const results = [];
  for (const rule of ready) results.push(await executeRule(rule, occupied));
  return results;
}

function localClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { time: `${values.hour}:${values.minute}`, day: dayMap[values.weekday] };
}

async function processTimeRules() {
  const clock = localClock();
  const rules = await AutomationRule.find({ enabled: true, 'trigger.type': 'time', 'trigger.time': clock.time }).sort({ priority: -1 });
  const occupied = new Set();
  for (const rule of rules) {
    if (rule.trigger.days?.length && !rule.trigger.days.includes(clock.day)) continue;
    if (rule.lastTriggeredAt && Date.now() - rule.lastTriggeredAt.getTime() < 55_000) continue;
    await executeRule(rule, occupied);
  }
}

async function processScheduledActions() {
  const due = await ScheduledAction.find({ status: 'pending', executeAt: { $lte: new Date() } }).sort({ executeAt: 1 }).limit(20);
  for (const item of due) {
    item.status = 'running';
    await item.save();
    try {
      item.result = await executeAction(item.action.toObject ? item.action.toObject() : item.action, { source: 'schedule' });
      item.status = item.result?.ok === false ? 'failed' : 'completed';
    } catch (error) {
      item.status = 'failed';
      item.result = { ok: false, error: error.message, code: error.code };
    }
    item.executedAt = new Date();
    await item.save();
    if (ioInstance) ioInstance.emit('scheduledActionUpdate', item.toJSON());
  }
}

function startAutomationEngine(mqttService, io) {
  if (started) return;
  started = true;
  ioInstance = io;
  mqttService.on('newSensorData', (sensor) => {
    evaluateSensorRules(sensor).catch((error) => console.error('Lỗi Automation Engine:', error));
  });
  Promise.all([processTimeRules(), processScheduledActions()]).catch((error) => console.error('Lỗi khởi tạo lịch tự động:', error));
  const timer = setInterval(() => {
    Promise.all([processTimeRules(), processScheduledActions()]).catch((error) => console.error('Lỗi lịch tự động:', error));
  }, 15_000);
  timer.unref?.();
}

module.exports = { startAutomationEngine, evaluateSensorRules, processTimeRules, processScheduledActions, executeAction, localClock };
