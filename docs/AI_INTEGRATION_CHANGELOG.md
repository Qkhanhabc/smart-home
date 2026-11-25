# Danh sách thay đổi tích hợp AI

## Thêm

- `IOT-main/ai/`: provider Ollama, tool schema, orchestrator và tool registry.
- `deviceCommandService`: điều khiển có timeout, chống trùng, phân loại xác nhận và safety guard.
- `automationEngine`, `sceneService`: quy tắc, lịch hẹn và kịch bản độc lập với LLM.
- Models: `AutomationRule`, `ScheduledAction`, `Scene`, `PendingAiAction`.
- API `/api/automations/*` và luồng confirm/cancel của Assistant.
- Giao diện chatbot responsive có trạng thái ESP32, cards, quick prompts và confirmation.
- Unit tests và integration-test harness.
- Tài liệu kiến trúc, API, HIL và demo.

## Sửa

- `mqttService`: theo dõi độ mới, desired/reported state và nguồn lệnh.
- `controlController`, `acController`: dùng lớp điều khiển chung và chờ phản hồi.
- `ActionData`: bổ sung device ID, source, command ID và loại xác nhận.
- `automation.html`: hiển thị quy tắc AI và lịch đang chờ.
- `server.js`: chờ MongoDB trước khi chạy engine, giới hạn JSON và siết Socket.IO CORS.
- `.env.example`, `package.json`, `LOCAL_ASSISTANT.md`, `README.md`.

Không xóa firmware, dữ liệu người dùng hay thay đổi GPIO. Không thêm cảm biến ngọn lửa vì source/phần cứng chưa xác nhận.
