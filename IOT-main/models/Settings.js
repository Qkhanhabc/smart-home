// models/Settings.js
const mongoose = require('mongoose');


const SettingsSchema = new mongoose.Schema({
  temp: {
    type: Number,
    default: 30
  },
  humi: {
    type: Number,
    default: 80
  },
  light: {
    type: Number,
    default: 800
  },
  autoCoolingEnabled: { type: Boolean, default: false },
  autoCoolingMode: { type: String, enum: ['ac', 'fan', 'both'], default: 'both' },
  autoTempThreshold: { type: Number, default: 30, min: 16, max: 40 },
  autoAcMode: { type: String, enum: ['auto', 'cool', 'dry', 'fan'], default: 'cool' },
  autoAcTemp: { type: Number, default: 26, min: 16, max: 30 },
  autoAcFan: { type: String, enum: ['auto', 'low', 'medium', 'high'], default: 'auto' },
  autoLightingEnabled: { type: Boolean, default: false },
  autoLightThreshold: { type: Number, default: 1500, min: 0, max: 4095 },
  autoLightDirection: { type: String, enum: ['below', 'above'], default: 'below' },
  smokeEmailEnabled: { type: Boolean, default: false },
  smokeEmailTo: { type: String, default: '', trim: true, maxlength: 254 },
  startDate: {
    type: String,
    default: "" // Lưu trữ dưới dạng chuỗi YYYY-MM-DDTHH:mm
  },
  endDate: {
    type: String,
    default: "" // Lưu trữ dưới dạng chuỗi YYYY-MM-DDTHH:mm
  }
});

module.exports = mongoose.model('Settings', SettingsSchema);
