const mongoose = require('mongoose');

const AnomalyEventSchema = new mongoose.Schema({
  metric: { type: String, required: true, enum: ['temperature', 'humidity', 'light', 'mq2'] },
  label: { type: String, required: true },
  value: { type: Number, required: true },
  baseline: { type: Number, required: true },
  deviation: { type: Number, required: true },
  threshold: { type: Number, required: true },
  severity: { type: String, required: true, enum: ['medium', 'high'] },
  message: { type: String, required: true },
  occurrences: { type: Number, default: 1 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });

AnomalyEventSchema.index({ lastSeenAt: -1 });
module.exports = mongoose.model('AnomalyEvent', AnomalyEventSchema);
