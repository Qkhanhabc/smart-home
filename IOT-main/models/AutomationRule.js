const mongoose = require('mongoose');

const ConditionSchema = new mongoose.Schema({
  metric: { type: String, enum: ['temperature', 'humidity', 'light', 'mq2', 'person', 'smokeAlarm'], required: true },
  operator: { type: String, enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'], required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { _id: false });

const ActionSchema = new mongoose.Schema({
  type: { type: String, enum: ['device', 'air_conditioner', 'scene'], required: true },
  device: { type: String, enum: ['fan', 'ac', 'led1', 'led2', 'led3'] },
  power: { type: Boolean },
  mode: { type: String, enum: ['auto', 'cool', 'dry', 'fan'] },
  temp: { type: Number, min: 16, max: 30 },
  fan: { type: String, enum: ['auto', 'low', 'medium', 'high'] },
  scene: { type: String }
}, { _id: false });

const AutomationRuleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  enabled: { type: Boolean, default: true },
  trigger: {
    type: {
      type: String,
      enum: ['sensor', 'time'],
      required: true
    },
    metric: { type: String, enum: ['temperature', 'humidity', 'light', 'mq2', 'person', 'smokeAlarm'] },
    operator: { type: String, enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'] },
    value: mongoose.Schema.Types.Mixed,
    durationSeconds: { type: Number, min: 0, max: 86400, default: 0 },
    time: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    days: [{ type: Number, min: 0, max: 6 }]
  },
  conditions: { type: [ConditionSchema], default: [] },
  actions: { type: [ActionSchema], required: true, validate: (value) => Array.isArray(value) && value.length > 0 && value.length <= 10 },
  cooldownSeconds: { type: Number, min: 5, max: 86400, default: 60 },
  priority: { type: Number, min: 0, max: 100, default: 50 },
  lastTriggeredAt: { type: Date, default: null },
  lastResult: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

AutomationRuleSchema.index({ enabled: 1, 'trigger.type': 1, priority: -1 });
module.exports = mongoose.model('AutomationRule', AutomationRuleSchema);
