const mongoose = require('mongoose');

const AcRawSlotSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 16 },
  lastLearnedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AcRawSlot', AcRawSlotSchema);
