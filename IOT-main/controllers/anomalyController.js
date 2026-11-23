const AnomalyEvent = require('../models/AnomalyEvent');

exports.getRecent = async (_req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const events = await AnomalyEvent.find({ lastSeenAt: { $gte: since } }).sort({ lastSeenAt: -1 }).limit(10).lean();
    res.json({ events, baselineSamplesRequired: 12, historyWindow: 30 });
  } catch (error) {
    console.error('Không lấy được phân tích bất thường:', error);
    res.status(500).json({ message: 'Không lấy được dữ liệu phân tích.' });
  }
};
