# AI Smart Home Assistant

Trợ lý dùng Ollama trên cùng máy với backend và có Tool Calling. LLM không truy cập trực tiếp GPIO, MQTT, MongoDB hay shell. Mọi thao tác đi qua danh sách tool cố định, được backend xác thực trước khi đọc dữ liệu hoặc gửi lệnh.

## Cài đặt

1. Cài và mở Ollama.
2. Tải model hỗ trợ tool calling:

   ```powershell
   ollama pull qwen2.5:3b
   ```

3. Trong `.env`, giữ hoặc sửa:

   ```dotenv
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=qwen2.5:3b
   AI_TIMEOUT_MS=120000
   ```

4. Khởi động lại backend. Chatbot xuất hiện ở góc dưới bên phải các trang sau khi đăng nhập.

## Khả năng

- Đọc dữ liệu cảm biến và trạng thái kết nối mới nhất từ MQTT.
- Tính min/max/trung bình từ MongoDB thay vì để LLM tự tính hoặc tự tạo số liệu.
- Điều khiển quạt, ba LED và điều hòa qua MQTT.
- Chờ trạng thái quạt/LED do ESP32 báo về trước khi nói đã xác nhận.
- Với điều hòa IR một chiều, luôn phân biệt “ESP32 đã xử lý lệnh IR” với trạng thái vật lý chưa xác minh.
- Tạo quy tắc, lịch hẹn và kích hoạt kịch bản sau khi người dùng bấm xác nhận.
- Dùng tối đa 12 tin nhắn gần nhất trong tab để hiểu ngữ cảnh liên tiếp.

## Ánh xạ phòng

Source hiện tại chỉ xác nhận `fan`, `ac`, `led1`, `led2`, `led3`; chưa xác nhận LED nào thuộc phòng nào. Không nên để AI đoán từ ảnh mô hình. Sau khi kiểm tra dây thực tế, khai báo trong `.env`, ví dụ:

```dotenv
DEVICE_LABELS_JSON={"led1":{"label":"Đèn phòng khách","room":"phòng khách","aliases":["đèn khách"]}}
```

## An toàn

- Cảnh báo MQ-2, còi và LED chạy độc lập trong firmware, không phụ thuộc AI.
- AI/automation/lịch/kịch bản bị chặn bật quạt khi `smokeAlarm=true`.
- Lệnh dài hạn và kịch bản nhiều thiết bị cần xác nhận trong giao diện.
- Tool chỉ chấp nhận thiết bị, mode, nhiệt độ và toán tử trong allowlist.
- Chatbot có giới hạn 12 yêu cầu/phút cho mỗi tài khoản.
- Nếu ESP32 offline hoặc dữ liệu quá 10 giây, UI và tool đánh dấu dữ liệu không còn mới.

## Dữ liệu hội thoại

Tin nhắn được giữ trong bộ nhớ của tab trình duyệt và gửi tới Ollama cục bộ. Backend không lưu nội dung chat vào MongoDB. Các cấu trúc automation đã được xác nhận mới được lưu.
