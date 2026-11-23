// utils/dataAggregator.js
const SensorData = require('../models/SensorData');
const { analyzeSensorSample } = require('./anomalyDetector');

let latestData = null;

const startDataAggregation = (mqttService, io) => {
  // Lắng nghe sự kiện dữ liệu mới từ MQTT
  mqttService.on('newSensorData', (data) => {
    latestData = data;
  });

  // Lưu mẫu mới nhất vào DB mỗi phút
  setInterval(async () => {
    if (latestData) {
      const sample = latestData;
      latestData = null;
      try {
        const dataToSave = new SensorData({
          temperature: sample.temperature,
          humidity: sample.humidity,
          light: sample.light,
          mq2: sample.mq2,
          person: sample.person,
          smokeAlarm: sample.smokeAlarm,
          fanRelay: sample.fanRelay
          // createdAt sẽ được tự động thêm vào
        });
        await dataToSave.save();
        console.log('Dữ liệu sensor đã được lưu vào MongoDB:', dataToSave);
        await analyzeSensorSample(dataToSave, io);
      } catch (error) {
        if (!latestData) latestData = sample;
        console.error('Lỗi khi lưu dữ liệu vào MongoDB:', error);
      }
    }
  }, 60_000); // Lưu mỗi phút
};

module.exports = { startDataAggregation };
