// models/SensorData.js
const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema({
  temperature: {
    type: Number,
    default: null,
  },
  humidity: {
    type: Number,
    default: null,
  },
  light: {
    type: Number,
    default: null,
  },
  mq2: {
    type: Number,
    default: null,
  },
  person: {
    type: Boolean,
    default: null,
  },
  smokeAlarm: {
    type: Boolean,
    default: false,
  },
  fanRelay: {
    type: Boolean,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now // Sửa lại để tự động gán ngày giờ
  },
});

module.exports = mongoose.model('SensorData', SensorDataSchema);
