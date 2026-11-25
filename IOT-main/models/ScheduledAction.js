const mongoose = require('mongoose');

const ScheduledActionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  executeAt: { type: Date, required: true, index: true },
  action: {
    type: { type: String, enum: ['device', 'air_conditioner', 'scene'], required: true },
    device: { type: String, enum: ['fan', 'ac', 'led1', 'led2', 'led3'] },
    power: Boolean,
    mode: { type: String, enum: ['auto', 'cool', 'dry', 'fan'] },
    temp: { type: Number, min: 16, max: 30 },
    fan: { type: String, enum: ['auto', 'low', 'medium', 'high'] },
    scene: String
  },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending', index: true },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
  executedAt: { type: Date, default: null }
});

ScheduledActionSchema.index({ status: 1, executeAt: 1 });
module.exports = mongoose.model('ScheduledAction', ScheduledActionSchema);
