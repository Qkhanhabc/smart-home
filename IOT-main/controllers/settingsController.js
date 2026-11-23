// controllers/settingsController.js
const Settings = require('../models/Settings');

// Dùng findOneAndUpdate với upsert: true để luôn cập nhật 1 document duy nhất
const findOneAndUpdateOptions = {
    upsert: true, // Tạo mới nếu chưa tồn tại
    new: true, // Trả về document đã được cập nhật
    setDefaultsOnInsert: true // Áp dụng default (30, 80, 800) nếu tạo mới
};

// Lấy cài đặt 
exports.getSettings = async (req, res) => {
    try {
        // Tìm 1 cài đặt bất kỳ (hoặc tạo mới nếu rỗng)
        const settings = await Settings.findOneAndUpdate({}, {}, findOneAndUpdateOptions);
        res.json(settings);
    } catch (error) {
        console.error('Lỗi khi lấy cài đặt:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};

// Cập nhật cài đặt (CẬP NHẬT HÀM NÀY)
exports.updateSettings = async (req, res) => {
    try {
        // Lấy cả ngưỡng và ngày/giờ từ body
        const { temp, humi, light, startDate, endDate } = req.body;
        
        const current = await Settings.findOne().lean();
        const newSettings = { ...(current || {}) };
        delete newSettings._id;
        delete newSettings.__v;
        for (const [field, value] of Object.entries({ temp, humi, light })) {
            if (value !== undefined) {
                const parsed = Number(value);
                if (!Number.isFinite(parsed)) return res.status(400).json({ message: `${field} không hợp lệ` });
                newSettings[field] = parsed;
            }
        }
        if (startDate !== undefined) newSettings.startDate = startDate || "";
        if (endDate !== undefined) newSettings.endDate = endDate || "";

        const numericRanges = { autoTempThreshold: [16, 40], autoAcTemp: [16, 30], autoLightThreshold: [0, 4095] };
        for (const [field, [min, max]] of Object.entries(numericRanges)) {
            if (req.body[field] !== undefined) {
                const value = Number(req.body[field]);
                if (!Number.isFinite(value) || value < min || value > max) {
                    return res.status(400).json({ message: `${field} phải nằm trong khoảng ${min} đến ${max}` });
                }
                newSettings[field] = value;
            }
        }
        const enums = {
            autoCoolingMode: ['ac', 'fan', 'both'],
            autoAcMode: ['auto', 'cool', 'dry', 'fan'],
            autoAcFan: ['auto', 'low', 'medium', 'high'],
            autoLightDirection: ['below', 'above']
        };
        for (const [field, allowed] of Object.entries(enums)) {
            if (req.body[field] !== undefined) {
                if (!allowed.includes(req.body[field])) return res.status(400).json({ message: `${field} không hợp lệ` });
                newSettings[field] = req.body[field];
            }
        }
        for (const field of ['autoCoolingEnabled', 'autoLightingEnabled']) {
            if (req.body[field] !== undefined) {
                if (typeof req.body[field] !== 'boolean') return res.status(400).json({ message: `${field} phải là true hoặc false` });
                newSettings[field] = req.body[field];
            }
        }
        if (req.body.smokeEmailEnabled !== undefined) {
            if (typeof req.body.smokeEmailEnabled !== 'boolean') return res.status(400).json({ message: 'smokeEmailEnabled phải là true hoặc false' });
            newSettings.smokeEmailEnabled = req.body.smokeEmailEnabled;
        }
        if (req.body.smokeEmailTo !== undefined) {
            const email = String(req.body.smokeEmailTo).trim();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Email nhận cảnh báo không hợp lệ' });
            newSettings.smokeEmailTo = email;
        }

        // Cập nhật 1 document duy nhất
        const updatedSettings = await Settings.findOneAndUpdate({}, newSettings, findOneAndUpdateOptions);
        const mqttService = require('../services/mqttService');
        mqttService.updateAutomationSettings(updatedSettings);
        res.json(updatedSettings);
    } catch (error) {
        console.error('Lỗi khi cập nhật cài đặt:', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
};
