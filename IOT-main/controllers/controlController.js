// controllers/controlController.js
const mqttService = require('../services/mqttService');
const ActionData = require('../models/ActionData');
const topics = require('../config/mqttTopics');

exports.controlDevice = async (req, res) => {
  const { device, action } = req.body;
  if (!['on', 'off'].includes(String(action).toLowerCase())) {
    return res.status(400).json({ message: 'Action phải là on hoặc off' });
  }

  let topic;
  let payload;
  const power = String(action).toLowerCase() === 'on' ? 1 : 0;
  if (device === 'điều hòa' || device === 'ac') {
    topic = topics.acCommand;
    payload = JSON.stringify({ power });
  } else if (device === 'quạt' || device === 'fan') {
    topic = topics.deviceCommand;
    payload = JSON.stringify({ device: 'fan', power });
  } else if (device === 'đèn' || device === 'led1') {
    topic = topics.deviceCommand;
    payload = JSON.stringify({ device: 'led1', power });
  } else if (device === 'đèn 2' || device === 'led2') {
    topic = topics.deviceCommand;
    payload = JSON.stringify({ device: 'led2', power });
  } else if (device === 'đèn 3' || device === 'led3') {
    topic = topics.deviceCommand;
    payload = JSON.stringify({ device: 'led3', power });
  } else {
    return res.status(400).json({ message: 'Thiết bị không hợp lệ' });
  }

  if (!mqttService.client.connected) {
    return res.status(503).json({ message: 'Backend chưa kết nối MQTT broker' });
  }

  mqttService.client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
    if (err) {
      console.error('Lỗi khi gửi lệnh MQTT:', err);
      return res.status(500).json({ message: 'Lỗi khi gửi lệnh đến MQTT' });
    }
    res.json({ message: `Đã gửi lệnh ${action} cho ${device}`, pending: true });
  });
};

exports.getActionData = async (req, res) => {
  try {
    const { device, status, time, globalSearch, page = 1, limit = 10, order } = req.query;
    const filter = {};
    let sort = { time: -1 };

    if (globalSearch) {
        const searchRegex = new RegExp(globalSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const orConditions = [
            { device: searchRegex },
            { status: searchRegex }
        ];
        orConditions.push({
            $expr: {
                $regexMatch: {
                    input: { $dateToString: { format: "%d/%m/%Y %H:%M:%S", date: "$time", timezone: "Asia/Ho_Chi_Minh" } },
                    regex: searchRegex
                }
            }
        });
        filter.$or = orConditions;
    }

    if (device) filter.device = new RegExp(device, 'i');
    if (status) filter.status = status;
    
    if (time) {
        const parts = time.match(/(\d{2})\/(\d{2})\/(\d{2,4})\s(\d{2}):(\d{2}):?(\d{2})?/);
        if (parts) {
            const day = parseInt(parts[1], 10);
            const month = parseInt(parts[2], 10) - 1;
            let year = parseInt(parts[3], 10);
            if (year < 100) year += 2000; // Chuyển yy thành yyyy
            const hour = parseInt(parts[4], 10);
            const minute = parseInt(parts[5], 10);
            const second = parts[6] ? parseInt(parts[6], 10) : 0;

            const startDate = new Date(Date.UTC(year, month, day, hour, minute, second) - (7 * 60 * 60 * 1000)); // Trừ 7 giờ để về UTC
            
            if (!isNaN(startDate.getTime())) {
                const endDate = new Date(startDate);
                if (parts[6]) {
                    endDate.setSeconds(startDate.getSeconds() + 1);
                } else {
                    endDate.setMinutes(startDate.getMinutes() + 1);
                }
                filter.time = { $gte: startDate, $lt: endDate };
            }
        }
    }

    if (order) { 
        try {
            const orderBy = JSON.parse(order);
            if(orderBy.length > 0) {
                sort = {};
                orderBy.forEach(o => {
                    if (o.column) sort[o.column] = o.dir === 'asc' ? 1 : -1;
                });
            }
        } catch(e) { console.error("Lỗi parse JSON cho order:", e); }
    }
    
    const totalCount = await ActionData.countDocuments(filter);
    const data = await ActionData.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
      
    res.json({ totalCount, filteredCount: totalCount, data });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu history:', error);
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu history' });
  }
};
