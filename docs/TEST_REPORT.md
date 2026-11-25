# Báo cáo kiểm thử tích hợp AI

Ngày thực hiện: 25/11/2026 (Asia/Bangkok).

## Đã chạy

- `npm test`: unit tests cho Device Registry, automation validation/evaluation, safety policy, Mongoose schemas, tool schemas và vòng lặp Tool Calling.
- `node --check`: kiểm tra cú pháp toàn bộ JavaScript ngoài `node_modules`.
- Module load smoke test: nạp models, command service, automation engine và assistant service với MQTT test endpoint.
- Backend startup smoke test: nạp toàn bộ server/routes/services và xác nhận thoát rõ ràng khi MongoDB test không khả dụng.
- `npm ls --depth=0`: dependency tree đầy đủ.
- `npm audit`: 0 vulnerability sau khi cập nhật các bản vá tương thích cho Express, Mongoose, Socket.IO và dependency con.

## Kết quả gần nhất

- Unit/orchestration/schema/inline-script tests: 19 passed.
- Integration harness: 2 skipped vì máy hiện tại không có `mongod`, Ollama và ESP32 đang kết nối.
- JavaScript syntax: passed.
- Module load: passed.
- Dependency audit: 0 vulnerability.

Hai integration tests có thể bật khi backend đang chạy:

```powershell
$env:RUN_INTEGRATION_TESTS='1'
$env:TEST_BASE_URL='http://127.0.0.1:3000'
npm test
```

## Chưa thể xác minh trong môi trường hiện tại

- Nạp/biên dịch firmware trên đúng board ESP32-S3.
- Relay, LED, cảm biến và IR vật lý.
- MQTT broker/tài khoản thật.
- MongoDB/Ollama runtime thật.
- Ánh xạ LED với từng phòng.

Thực hiện checklist trong `HARDWARE_IN_THE_LOOP_TEST.md` trước khi tuyên bố hệ thống phần cứng đạt end-to-end.
