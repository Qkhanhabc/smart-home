const AutomationRule = require('../models/AutomationRule');
const ScheduledAction = require('../models/ScheduledAction');
const Scene = require('../models/Scene');
const sceneService = require('../services/sceneService');
const { validateRuleInput, validateAction } = require('../utils/automationRules');

exports.listRules = async (req, res) => {
  const rules = await AutomationRule.find({ userId: req.authUser._id }).sort({ createdAt: -1 }).lean();
  res.json({ rules });
};

exports.createRule = async (req, res) => {
  const error = validateRuleInput(req.body);
  if (error) return res.status(400).json({ message: error });
  const rule = await AutomationRule.create({ ...req.body, userId: req.authUser._id });
  res.status(201).json(rule);
};

exports.updateRule = async (req, res) => {
  const error = validateRuleInput(req.body, { partial: true });
  if (error) return res.status(400).json({ message: error });
  const allowed = ['name', 'enabled', 'trigger', 'conditions', 'actions', 'cooldownSeconds', 'priority'];
  const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  update.updatedAt = new Date();
  const rule = await AutomationRule.findOneAndUpdate({ _id: req.params.id, userId: req.authUser._id }, update, { new: true, runValidators: true });
  if (!rule) return res.status(404).json({ message: 'Không tìm thấy quy tắc.' });
  res.json(rule);
};

exports.deleteRule = async (req, res) => {
  const rule = await AutomationRule.findOneAndDelete({ _id: req.params.id, userId: req.authUser._id });
  if (!rule) return res.status(404).json({ message: 'Không tìm thấy quy tắc.' });
  res.json({ deleted: true, id: rule._id });
};

exports.listSchedules = async (req, res) => {
  const schedules = await ScheduledAction.find({ userId: req.authUser._id }).sort({ executeAt: 1 }).limit(100).lean();
  res.json({ schedules });
};

exports.createSchedule = async (req, res) => {
  const { description, executeAt, action } = req.body || {};
  const actionError = validateAction(action);
  const date = new Date(executeAt);
  if (actionError) return res.status(400).json({ message: actionError });
  if (!Number.isFinite(date.getTime()) || date <= new Date()) return res.status(400).json({ message: 'Thời điểm thực hiện phải ở tương lai.' });
  const schedule = await ScheduledAction.create({ userId: req.authUser._id, description: String(description || 'Tác vụ hẹn giờ').slice(0, 200), executeAt: date, action });
  res.status(201).json(schedule);
};

exports.cancelSchedule = async (req, res) => {
  const schedule = await ScheduledAction.findOneAndUpdate({ _id: req.params.id, userId: req.authUser._id, status: 'pending' }, { status: 'cancelled' }, { new: true });
  if (!schedule) return res.status(404).json({ message: 'Không tìm thấy tác vụ đang chờ.' });
  res.json(schedule);
};

exports.listScenes = async (_req, res) => {
  const scenes = await Scene.find({ enabled: true }).sort({ name: 1 }).lean();
  res.json({ scenes });
};

exports.updateScene = async (req, res) => {
  const allowed = ['name', 'description', 'aliases', 'actions', 'enabled'];
  const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (update.actions !== undefined) {
    if (!Array.isArray(update.actions) || update.actions.length > 10) return res.status(400).json({ message: 'Kịch bản chỉ nhận tối đa 10 hành động.' });
    for (const action of update.actions) {
      const error = validateAction(action);
      if (error || action.type === 'scene') return res.status(400).json({ message: error || 'Kịch bản không được gọi lồng kịch bản khác.' });
      if (action.type === 'air_conditioner' && !action.device) action.device = 'ac';
    }
  }
  update.updatedAt = new Date();
  const scene = await Scene.findOneAndUpdate({ key: req.params.key }, update, { new: true, runValidators: true });
  if (!scene) return res.status(404).json({ message: 'Không tìm thấy kịch bản.' });
  res.json(scene);
};

exports.activateScene = async (req, res) => {
  try {
    const result = await sceneService.activateScene(req.params.key, { userId: req.authUser._id, source: 'scene' });
    res.status(result.ok ? 200 : 207).json(result);
  } catch (error) {
    res.status(error.code === 'ESP32_OFFLINE' ? 503 : 400).json({ message: error.message, code: error.code });
  }
};
