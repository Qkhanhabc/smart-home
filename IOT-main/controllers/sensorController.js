// controllers/sensorController.js
const SensorData = require('../models/SensorData');

exports.getSensorData = async (req, res) => {
  try {
    const { temperature, humidity, light, mq2, person, smokeAlarm, createdAt, globalSearch, page = 1, limit = 10, order } = req.query;
    const filter = {};
    let sort = { createdAt: -1 };

    if (globalSearch) {
        const numValue = parseFloat(globalSearch);
        const orConditions = [];

        if (!isNaN(numValue)) {
            orConditions.push(
                { temperature: numValue },
                { humidity: numValue },
                { light: numValue },
                { mq2: numValue }
            );
        }

        const booleanSearch = globalSearch.trim().toLowerCase();
        if (['true', '1', 'yes', 'co', 'có'].includes(booleanSearch)) {
            orConditions.push({ person: true }, { smokeAlarm: true });
        } else if (['false', '0', 'no', 'khong', 'không'].includes(booleanSearch)) {
            orConditions.push({ person: false }, { smokeAlarm: false });
        }
        
        const searchRegex = new RegExp(globalSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        orConditions.push({ 
            $expr: { 
                $regexMatch: { 
                    input: { $dateToString: { format: "%d/%m/%Y %H:%M:%S", date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" } },
                    regex: searchRegex
                } 
            } 
        });
        filter.$or = orConditions;
    }

    for (const [field, value] of Object.entries({ temperature, humidity, light, mq2 })) {
      if (value !== undefined && value !== '') {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return res.status(400).json({ message: `Giá trị lọc ${field} không hợp lệ` });
        }
        filter[field] = numericValue;
      }
    }

    const parseBoolean = (value) => {
      if (value === undefined || value === '') return undefined;
      if (['true', '1', 'yes', 'co', 'có'].includes(String(value).toLowerCase())) return true;
      if (['false', '0', 'no', 'khong', 'không'].includes(String(value).toLowerCase())) return false;
      return null;
    };
    const personValue = parseBoolean(person);
    const alarmValue = parseBoolean(smokeAlarm);
    if (personValue === null || alarmValue === null) {
      return res.status(400).json({ message: 'Giá trị lọc trạng thái phải là true hoặc false' });
    }
    if (personValue !== undefined) filter.person = personValue;
    if (alarmValue !== undefined) filter.smokeAlarm = alarmValue;
    
    if (createdAt) {
      const parts = createdAt.match(/(\d{2})\/(\d{2})\/(\d{2,4})\s(\d{2}):(\d{2}):?(\d{2})?/);
      if (parts) {
          const day = parseInt(parts[1], 10);
          const month = parseInt(parts[2], 10) - 1;
          let year = parseInt(parts[3], 10);
          if (year < 100) year += 2000;
          const hour = parseInt(parts[4], 10);
          const minute = parseInt(parts[5], 10);
          const second = parts[6] ? parseInt(parts[6], 10) : 0;

          const startDate = new Date(Date.UTC(year, month, day, hour, minute, second) - (7 * 60 * 60 * 1000));
          
          if (!isNaN(startDate.getTime())) {
              const endDate = new Date(startDate);
              if (parts[6]) {
                  endDate.setSeconds(startDate.getSeconds() + 1);
              } else {
                  endDate.setMinutes(startDate.getMinutes() + 1);
              }
              filter.createdAt = { $gte: startDate, $lt: endDate };
          }
      }
    }

    if (order) { 
        try {
            const orderBy = JSON.parse(order);
            if(orderBy.length > 0) {
                sort = {};
                const allowedSortFields = new Set(['temperature', 'humidity', 'light', 'mq2', 'person', 'smokeAlarm', 'createdAt']);
                orderBy.forEach(o => {
                    if (allowedSortFields.has(o.column)) sort[o.column] = o.dir === 'asc' ? 1 : -1;
                });
            }
        } catch(e) { console.error("Error parsing order JSON"); }
    }

    const totalCount = await SensorData.countDocuments(filter);
    const data = await SensorData.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
      
    res.json({ totalCount, filteredCount: totalCount, data });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu sensor:', error);
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu sensor' });
  }
};
