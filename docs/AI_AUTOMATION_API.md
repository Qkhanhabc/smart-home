# API AI và Automation

Tất cả endpoint dưới đây yêu cầu cookie phiên đăng nhập.

## Assistant

- `POST /api/assistant/chat`
  - Body: `{ "messages": [{ "role": "user", "content": "Nhiệt độ hiện tại?" }] }`
  - Trả `answer`, `toolResults`, `pendingActions`, `systemStatus`.
- `GET /api/assistant/status`: trạng thái MQTT, ESP32, tuổi dữ liệu và trạng thái thiết bị.
- `POST /api/assistant/confirm`: `{ "id": "pending-action-id" }`.
- `POST /api/assistant/cancel`: `{ "id": "pending-action-id" }`.

Pending action thuộc đúng tài khoản, hết hạn sau 15 phút và được claim nguyên tử trước khi thực hiện để tránh bấm hai lần.

## Automation rules

- `GET /api/automations/rules`
- `POST /api/automations/rules`
- `PATCH /api/automations/rules/:id`
- `DELETE /api/automations/rules/:id`

Ví dụ quy tắc:

```json
{
  "name": "Bật quạt khi nóng và có người",
  "trigger": {
    "type": "sensor",
    "metric": "temperature",
    "operator": "gt",
    "value": 30,
    "durationSeconds": 30
  },
  "conditions": [
    { "metric": "person", "operator": "eq", "value": true }
  ],
  "actions": [
    { "type": "device", "device": "fan", "power": true }
  ],
  "cooldownSeconds": 120,
  "priority": 50
}
```

Toán tử: `gt`, `gte`, `lt`, `lte`, `eq`, `neq`. Metric: `temperature`, `humidity`, `light`, `mq2`, `person`, `smokeAlarm`.

Time trigger dùng `time: "23:00"` và tùy chọn `days: [0,1,...,6]`, với 0 là Chủ nhật. Engine dùng múi giờ `Asia/Ho_Chi_Minh`.

## Lịch hẹn

- `GET /api/automations/schedules`
- `POST /api/automations/schedules`
- `DELETE /api/automations/schedules/:id`

Lịch được lưu MongoDB, do đó không mất khi backend khởi động lại. Worker kiểm tra mỗi 15 giây.

## Kịch bản

- `GET /api/automations/scenes`
- `PATCH /api/automations/scenes/:key` để sửa tên, mô tả, aliases, trạng thái và tối đa 10 actions.
- `POST /api/automations/scenes/:key/activate`

Kịch bản mặc định: `sleep`, `away`, `home`, `cooling`, `energy_saving`. Các kịch bản không tắt còi hoặc LED cảnh báo an toàn.
