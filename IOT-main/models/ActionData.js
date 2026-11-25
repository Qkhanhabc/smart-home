// E:\src_tmanh\IOT\models\ActionDatajs

const mongoose = require('mongoose');

const ActionDataSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    enum: ['fan', 'ac', 'led1', 'led2', 'led3'],
    default: undefined
  },
  device: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['on', 'off'],
    required: true
  },
  source: {
    type: String,
    enum: ['dashboard', 'ai', 'automation', 'schedule', 'scene', 'physical', 'unknown'],
    default: 'unknown'
  },
  commandId: { type: String, default: undefined },
  verification: {
    type: String,
    enum: ['reported_by_esp32', 'ir_command_only', 'unconfirmed', 'unknown'],
    default: 'unknown'
  },
  time: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ActionData', ActionDataSchema);
