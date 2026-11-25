// controllers/controlController.js
const deviceCommandService = require('../services/deviceCommandService');
const ActionData = require('../models/ActionData');

exports.controlDevice = async (req, res) => {
  const { device, action } = req.body;
  if (!['on', 'off'].includes(String(action).toLowerCase())) {
    return res.status(400).json({ message: 'Action phải là on hoặc off' });
  }

  try {
    const result = await deviceCommandService.controlDevice({ device, power: String(action).toLowerCase() === 'on' }, { source: 'dashboard', userId: req.authUser._id });
    return res.status(result.status === 'sent_unconfirmed' ? 202 : 200).json({ ...result, message: result.message || `Đã xử lý lệnh ${action} cho ${device}` });
  } catch (error) {
    const status = ['MQTT_OFFLINE', 'ESP32_OFFLINE'].includes(error.code) ? 503 : error.code === 'SAFETY_BLOCK' ? 409 : 400;
    return res.status(status).json({ message: error.message, code: error.code });
  }
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
