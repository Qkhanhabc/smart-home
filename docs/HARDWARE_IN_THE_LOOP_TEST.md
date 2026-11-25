# Quy trình Hardware-in-the-loop

Không được coi bước này là đạt nếu chưa nối mô hình ESP32 thật.

## Chuẩn bị

1. Kiểm tra nguồn, mức logic, relay và đúng GPIO theo `SmartHome_AC_Integrated/SmartHome_AC_Integrated.ino`.
2. Điền Wi-Fi/MQTT vào `SmartHome_AC_Integrated/config.h`.
3. Backend và ESP32 dùng cùng broker/topic; mở Serial Monitor 115200 baud.
4. Khởi động MongoDB, Ollama và backend; đăng nhập website.

## Checklist

- Chờ UI chatbot báo `ESP32 trực tuyến`; tắt nguồn ESP32 và xác nhận UI chuyển offline trong tối đa 75 giây.
- Hỏi nhiệt độ/độ ẩm; đối chiếu với LCD và MQTT payload, không chấp nhận số do model tự tạo.
- Ra lệnh bật/tắt quạt; kiểm tra relay, phản hồi `device/state` và Dashboard cùng đổi.
- Ra lệnh từng `led1`, `led2`, `led3`; ghi lại phòng thực tế rồi cấu hình `DEVICE_LABELS_JSON`.
- Ghép remote điều hòa; thử power và 26°C. Kết quả chatbot phải nói rõ chỉ xác nhận lệnh IR.
- Che cảm biến ánh sáng/di chuyển trước radar và kiểm tra dữ liệu.
- Dùng nguồn khói thử chuyên dụng an toàn cho MQ-2; xác nhận còi/LED tại ESP32 vẫn chạy khi tắt Internet/backend.
- Trong lúc `smokeAlarm=true`, yêu cầu AI bật quạt; backend phải trả `SAFETY_BLOCK`.
- Tạo quy tắc “nhiệt độ > ngưỡng và có người thì bật quạt”, bấm xác nhận và kiểm tra cooldown.
- Hẹn tắt quạt sau 1 phút, khởi động lại backend trước giờ chạy và xác nhận lịch vẫn thực hiện.
- Gửi cùng lệnh hai lần nhanh; chỉ một chu kỳ điều khiển được chờ/xử lý.

## Bằng chứng cần lưu

- Serial log ESP32.
- MQTT topic/payload và thời gian.
- Ảnh trạng thái relay/LED/LCD.
- Response JSON của API.
- Bản ghi `ActionData`, `AutomationRule`, `ScheduledAction` tương ứng.
