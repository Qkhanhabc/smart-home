const mongoose = require('mongoose');

const SceneActionSchema = new mongoose.Schema({
  type: { type: String, enum: ['device', 'air_conditioner'], required: true },
  device: { type: String, enum: ['fan', 'ac', 'led1', 'led2', 'led3'], required: true },
  power: Boolean,
  mode: { type: String, enum: ['auto', 'cool', 'dry', 'fan'] },
  temp: { type: Number, min: 16, max: 30 },
  fan: { type: String, enum: ['auto', 'low', 'medium', 'high'] }
}, { _id: false });

const SceneSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  aliases: { type: [String], default: [] },
  description: { type: String, default: '', maxlength: 300 },
  actions: { type: [SceneActionSchema], default: [] },
  enabled: { type: Boolean, default: true },
  builtIn: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Scene', SceneSchema);
