const SensorData = require('../models/SensorData');
const AnomalyEvent = require('../models/AnomalyEvent');

const HISTORY_SIZE = 30;
const MIN_BASELINE = 12;
const COOLDOWN_MS = 30 * 60 * 1000;
const METRICS = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', floor: 4 },
  { key: 'humidity', label: 'Độ ẩm', unit: '%', floor: 15 },
  { key: 'light', label: 'Ánh sáng', unit: 'ADC', floor: 600 },
  { key: 'mq2', label: 'MQ-2', unit: 'ADC', floor: 400 }
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function inspectMetric(sample, metric, now) {
  const query = { [metric.key]: { $ne: null }, createdAt: { $lt: sample.createdAt } };
  const rows = await SensorData.find(query).sort({ createdAt: -1 }).limit(HISTORY_SIZE).select(metric.key).lean();
  const values = rows.map((row) => Number(row[metric.key])).filter(Number.isFinite);
  if (values.length < MIN_BASELINE) return;

  const baseline = median(values);
  const mad = median(values.map((value) => Math.abs(value - baseline)));
  const threshold = Math.max(metric.floor, 3.5 * 1.4826 * mad);
  const value = Number(sample[metric.key]);
  const deviation = Math.abs(value - baseline);
  if (!Number.isFinite(value) || deviation <= threshold) return;

  const severity = deviation > threshold * 2.5 ? 'high' : 'medium';
  const message = `${metric.label} ${value} ${metric.unit}, lệch ${deviation.toFixed(1)} ${metric.unit} so với mức nền ${baseline.toFixed(1)} ${metric.unit}.`;
  const cutoff = new Date(now.getTime() - COOLDOWN_MS);
  const recent = await AnomalyEvent.findOne({ metric: metric.key, lastSeenAt: { $gte: cutoff } }).sort({ lastSeenAt: -1 });
  if (recent) {
    recent.value = value;
    recent.baseline = baseline;
    recent.deviation = deviation;
    recent.threshold = threshold;
    recent.severity = severity;
    recent.message = message;
    recent.lastSeenAt = now;
    recent.occurrences += 1;
    await recent.save();
    return;
  }

  const event = await AnomalyEvent.create({ metric: metric.key, label: metric.label, value, baseline, deviation, threshold, severity, message, firstSeenAt: now, lastSeenAt: now });
  return event;
}

async function analyzeSensorSample(sample, io) {
  const now = sample.createdAt || new Date();
  for (const metric of METRICS) {
    try {
      const event = await inspectMetric(sample, metric, now);
      if (event && io) io.emit('sensorAnomaly', event.toJSON());
    } catch (error) {
      console.error(`[AI anomaly] ${metric.key} analysis failed:`, error.message);
    }
  }
}

module.exports = { analyzeSensorSample };
