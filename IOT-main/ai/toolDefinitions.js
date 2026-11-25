const tools = [
  {
    name: 'get_system_status',
    description: 'Lấy trạng thái kết nối MQTT, ESP32, độ mới dữ liệu cảm biến và tổng quan thiết bị.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_sensor_data',
    description: 'Lấy mẫu cảm biến thực tế mới nhất: nhiệt độ, độ ẩm, ánh sáng, MQ-2, hiện diện và cảnh báo khói.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_fire_status',
    description: 'Kiểm tra trạng thái cảnh báo khói/khí gas, nhiệt độ, MQ-2 và dữ liệu liên quan an toàn.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_device_status',
    description: 'Lấy trạng thái thiết bị đã được ESP32 báo cáo. Bỏ trống device để lấy tất cả.',
    parameters: {
      type: 'object',
      properties: { device: { type: 'string', description: 'ID hoặc tên thiết bị, ví dụ fan, ac, led1.' } },
      additionalProperties: false
    }
  },
  {
    name: 'get_sensor_history',
    description: 'Tính min, max, trung bình và thời điểm cực trị từ dữ liệu cảm biến thật trong MongoDB.',
    parameters: {
      type: 'object', required: ['metric'],
      properties: {
        metric: { type: 'string', enum: ['temperature', 'humidity', 'light', 'mq2'] },
        hours: { type: 'number', minimum: 1, maximum: 720, default: 24 }
      }, additionalProperties: false
    }
  },
  {
    name: 'get_alert_history',
    description: 'Lấy lịch sử bất thường cảm biến được hệ thống phát hiện.',
    parameters: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 } }, additionalProperties: false }
  },
  {
    name: 'get_device_history',
    description: 'Lấy lịch sử bật/tắt thiết bị từ dữ liệu thực tế đã lưu.',
    parameters: {
      type: 'object',
      properties: { device: { type: 'string' }, hours: { type: 'number', minimum: 1, maximum: 720, default: 24 } },
      additionalProperties: false
    }
  },
  {
    name: 'control_device',
    description: 'Bật hoặc tắt một quạt hay đèn thật qua ESP32/MQTT. Dùng set_air_conditioner cho điều hòa có nhiệt độ/chế độ.',
    parameters: {
      type: 'object', required: ['device', 'power'],
      properties: {
        device: { type: 'string', description: 'ID hoặc tên thiết bị đã cấu hình.' },
        room: { type: 'string', description: 'Tên phòng nếu đã cấu hình; nếu chưa rõ phải hỏi người dùng.' },
        power: { type: 'boolean' }
      }, additionalProperties: false
    }
  },
  {
    name: 'control_multiple_devices',
    description: 'Bật/tắt tối đa 10 thiết bị; trả về kết quả riêng từng thiết bị.',
    parameters: {
      type: 'object', required: ['commands'],
      properties: {
        commands: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'object', required: ['device', 'power'], properties: { device: { type: 'string' }, room: { type: 'string' }, power: { type: 'boolean' } }, additionalProperties: false } }
      }, additionalProperties: false
    }
  },
  {
    name: 'set_air_conditioner',
    description: 'Gửi lệnh IR điều hòa qua ESP32. Chỉ xác nhận được ESP32 đã xử lý lệnh, không xác minh được máy lạnh vật lý.',
    parameters: {
      type: 'object',
      properties: {
        power: { type: 'boolean' }, mode: { type: 'string', enum: ['auto', 'cool', 'dry', 'fan'] },
        temp: { type: 'integer', minimum: 16, maximum: 30 }, fan: { type: 'string', enum: ['auto', 'low', 'medium', 'high'] }
      }, additionalProperties: false, minProperties: 1
    }
  },
  {
    name: 'list_automation_rules',
    description: 'Liệt kê các quy tắc tự động hóa của người dùng.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'create_automation_rule',
    description: 'Chuẩn bị quy tắc tự động hóa từ ngôn ngữ tự nhiên. Luôn cần người dùng xác nhận trước khi lưu.',
    confirmationRequired: true,
    parameters: {
      type: 'object', required: ['name', 'trigger', 'actions'],
      properties: {
        name: { type: 'string' },
        trigger: { type: 'object', required: ['type'], properties: { type: { type: 'string', enum: ['sensor', 'time'] }, metric: { type: 'string', enum: ['temperature', 'humidity', 'light', 'mq2', 'person', 'smokeAlarm'] }, operator: { type: 'string', enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'] }, value: {}, durationSeconds: { type: 'number', minimum: 0, maximum: 86400 }, time: { type: 'string' }, days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } } } },
        conditions: { type: 'array' }, actions: { type: 'array', minItems: 1, maxItems: 10 }, cooldownSeconds: { type: 'number', minimum: 5, maximum: 86400 }, priority: { type: 'number', minimum: 0, maximum: 100 }
      }, additionalProperties: false
    }
  },
  {
    name: 'update_automation_rule',
    description: 'Chuẩn bị cập nhật một quy tắc; cần xác nhận trước khi lưu.',
    confirmationRequired: true,
    parameters: { type: 'object', required: ['id', 'changes'], properties: { id: { type: 'string' }, changes: { type: 'object' } }, additionalProperties: false }
  },
  {
    name: 'delete_automation_rule',
    description: 'Chuẩn bị xóa một quy tắc; cần xác nhận.',
    confirmationRequired: true,
    parameters: { type: 'object', required: ['id'], properties: { id: { type: 'string' } }, additionalProperties: false }
  },
  {
    name: 'schedule_device_action',
    description: 'Hẹn một hành động thiết bị trong tương lai; cần người dùng xác nhận.',
    confirmationRequired: true,
    parameters: {
      type: 'object', required: ['action'],
      properties: {
        description: { type: 'string' }, delay_minutes: { type: 'number', minimum: 0.1, maximum: 43200 }, execute_at: { type: 'string', description: 'Thời gian ISO có múi giờ.' },
        action: { type: 'object', required: ['type'], properties: { type: { type: 'string', enum: ['device', 'air_conditioner', 'scene'] }, device: { type: 'string' }, power: { type: 'boolean' }, mode: { type: 'string' }, temp: { type: 'integer' }, fan: { type: 'string' }, scene: { type: 'string' } } }
      }, additionalProperties: false
    }
  },
  {
    name: 'activate_scene',
    description: 'Kích hoạt kịch bản đi ngủ, ra ngoài, về nhà, làm mát hoặc tiết kiệm điện; cần xác nhận vì có thể điều khiển nhiều thiết bị.',
    confirmationRequired: true,
    parameters: { type: 'object', required: ['scene'], properties: { scene: { type: 'string' } }, additionalProperties: false }
  }
];

function asProviderTools() {
  return tools.map(({ name, description, parameters }) => ({ type: 'function', function: { name, description, parameters } }));
}

function getTool(name) {
  return tools.find((tool) => tool.name === name) || null;
}

module.exports = { tools, asProviderTools, getTool };
