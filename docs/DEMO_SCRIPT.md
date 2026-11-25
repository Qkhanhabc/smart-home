# Kịch bản demo đồ án

1. Mở Dashboard, chỉ trạng thái ESP32 và các thẻ cảm biến thay đổi thời gian thực.
2. Mở chatbot, hỏi “Tình trạng ngôi nhà hiện tại thế nào?”. Giải thích AI bắt buộc gọi tool đọc dữ liệu thật.
3. Nói “Nóng quá”. Cho AI đọc nhiệt độ/trạng thái và bật quạt; chỉ phản hồi thành công sau khi ESP32 báo relay.
4. Nói “Tắt nó sau 1 phút”. Trình bày khả năng hiểu ngữ cảnh, thẻ xác nhận và lịch được lưu MongoDB.
5. Yêu cầu “Nếu nhiệt độ trên 30°C và có người thì bật quạt”. Xác nhận quy tắc rồi mở trang Automation để xem.
6. Thử “Bật điều hòa 26 độ”. Nhấn mạnh hệ thống trung thực: ESP32 đã xử lý IR nhưng không có cảm biến phản hồi từ máy lạnh.
7. Mô phỏng MQ-2 theo quy trình an toàn. Chỉ ra còi/LED chạy cục bộ ngay cả khi ngắt backend/Internet; AI không được vô hiệu hóa cảnh báo hoặc tự bật quạt.
8. Rút kết nối ESP32, yêu cầu điều khiển và cho thấy backend từ chối thay vì báo thành công giả.
9. Kết thúc bằng thống kê lịch sử và giải thích dữ liệu được tính trong backend, không do LLM bịa.
