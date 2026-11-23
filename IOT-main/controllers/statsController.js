// controllers/statsController.js
const SensorData = require('../models/SensorData');
const ActionData = require('../models/ActionData');

// 1. API thống kê số lần vượt ngưỡng
exports.getThresholdStats = async (req, res) => {
  try {
    // Lấy giá trị ngưỡng và thời gian
    const { 
      temp_gt = 0, 
      humi_gt = 0, 
      light_gt = 0,
      startDate, // Tham số mới
      endDate    // Tham số mới
    } = req.query;

    const tempThreshold = parseFloat(temp_gt);
    const humiThreshold = parseFloat(humi_gt);
    const lightThreshold = parseFloat(light_gt);

    // --- Xây dựng bộ lọc thời gian cho SensorData (dùng createdAt) ---
    const baseFilter = {};
    if (startDate || endDate) {
        baseFilter.createdAt = {};
        if (startDate) {
            // new Date() sẽ parse chuỗi YYYY-MM-DDTHH:mm
            baseFilter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            baseFilter.createdAt.$lte = new Date(endDate);
        }
    }
   

    // Đếm số lượng, áp dụng cả bộ lọc cơ sở (thời gian) và bộ lọc riêng
    const [tempCount, humiCount, lightCount] = await Promise.all([
      SensorData.countDocuments({ 
        ...baseFilter, // Áp dụng bộ lọc thời gian
        temperature: { $gt: tempThreshold } 
      }),
      SensorData.countDocuments({ 
        ...baseFilter, // Áp dụng bộ lọc thời gian
        humidity: { $gt: humiThreshold } 
      }),
      SensorData.countDocuments({ 
        ...baseFilter, // Áp dụng bộ lọc thời gian
        light: { $gt: lightThreshold } 
      })
    ]);

    res.json({ tempCount, humiCount, lightCount });

  } catch (error) {
    console.error('Lỗi khi lấy thống kê ngưỡng:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// 2. API thống kê bật tắt ( LỌC NGÀY)
exports.getDeviceToggleStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Thêm $match cho ngày (dùng 'time') ---
    const timeFilter = {};
    if (startDate || endDate) {
        timeFilter.time = {};
        if (startDate) {
            timeFilter.time.$gte = new Date(startDate);
        }
        if (endDate) {
            timeFilter.time.$lte = new Date(endDate);
        }
    }
    
    const pipeline = [
      // Thêm bước lọc thời gian
      { $match: timeFilter }, 
      // Nhóm theo thiết bị
      { $group: {
          _id: '$device',
          count: { $sum: 1 } // Đếm số lượng hành động cho mỗi thiết bị
        }
      },
      // Sắp xếp giảm dần
      { $sort: { count: -1 } }
    ];
   
    
    const stats = await ActionData.aggregate(pipeline);

    res.json(stats);

  } catch (error) {
    console.error('Lỗi khi lấy thống kê bật tắt:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};