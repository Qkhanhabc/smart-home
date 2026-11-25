const mongoose = require('mongoose');

const PendingAiActionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toolName: { type: String, required: true },
  arguments: { type: mongoose.Schema.Types.Mixed, required: true },
  summary: { type: String, required: true, maxlength: 300 },
  status: { type: String, enum: ['pending', 'running', 'confirmed', 'cancelled', 'expired'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
});

module.exports = mongoose.model('PendingAiAction', PendingAiActionSchema);
