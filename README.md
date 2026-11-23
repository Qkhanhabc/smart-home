# Smart Home ESP32-S3 + IoT Dashboard

Dự án điều khiển nhà thông minh gồm firmware ESP32-S3, điều khiển máy lạnh bằng hồng ngoại, cảm biến, relay/quạt, website Node.js và MQTT. Hướng dẫn này dành cho người mới tải dự án về máy.

> **Bảo mật:** Trước khi nạp firmware, hãy tự điền Wi-Fi và MQTT trong `config.h` của sketch bạn dùng. Không đưa mật khẩu thật lên GitHub. Backend dùng file `IOT-main/.env` riêng; file này đã được Git bỏ qua.

## 1. Các thành phần

- **Firmware tích hợp:** `SmartHome_AC_Integrated/SmartHome_AC_Integrated.ino` — cảm biến, LCD, relay, LED, cảnh báo khói, IR máy lạnh và MQTT.
- **Firmware IR độc lập:** `iot_ir_ac_hybrid.ino` ở thư mục gốc — gateway IR/MQTT, không phải sketch Smart Home đầy đủ.
- **Sketch thử IR:** `IR_Raw_AC_Test/IR_Raw_AC_Test.ino`.
- **Web/API backend:** `IOT-main/` — dashboard, đăng nhập, dữ liệu cảm biến, điều khiển và tự động hóa.

Nếu bạn muốn chạy toàn bộ hệ thống trong ví dụ dây nối dưới đây, hãy bắt đầu từ firmware tích hợp.

## 2. Phần cứng và nối dây

Firmware tích hợp đang dùng các chân sau (tên GPIO trên ESP32-S3):

| Linh kiện | GPIO |
|---|---:|
| DHT11 | 4 |
| Thu IR / phát IR | 17 / 22 |
| Relay quạt | 14 |
| MQ-2 (ngõ analog) | 32 |
| Còi báo / LED cảnh báo | 23 / 25 |
| LED 1, 2, 3 | 19 / 21 / 18 |
| Radar hiện diện | 35 |
| Cảm biến ánh sáng | 34 |
| LCD I2C SDA / SCL | 26 / 27 |

Dùng đúng điện áp và sơ đồ chân của module bạn có. Kiểm tra mức logic/nguồn của relay, LCD và cảm biến trước khi cấp điện; không cấp tải công suất trực tiếp từ GPIO.

## 3. Chạy website và backend

Cần cài Node.js, npm, MongoDB và có tài khoản MQTT broker (ví dụ EMQX). Mở terminal tại thư mục dự án rồi chạy:

```sh
cd IOT-main
npm install
```

Tạo file `.env` từ mẫu:

```sh
# Windows PowerShell
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Mở `IOT-main/.env` và cấu hình:

- `MONGODB_URI`: địa chỉ MongoDB, mặc định dùng MongoDB local.
- `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`: thông tin broker.
- `PORT`: cổng website, mặc định `3000`.
- `PUBLIC_BASE_URL`: để `http://localhost:3000` khi chạy local.

Giá trị mẫu trong `.env.example` chỉ là ví dụ; nhập đúng endpoint và tài khoản do bạn quản lý/cấp. Không chia sẻ file `.env`.

Khởi động backend:

```sh
npm start
```

Mở [http://localhost:3000](http://localhost:3000), đăng ký tài khoản rồi đăng nhập. MongoDB và backend cần tiếp tục chạy trong lúc sử dụng dashboard.

### Email cảnh báo và khôi phục mật khẩu (tùy chọn)

Cấu hình SMTP theo `IOT-main/.env.mail.example`, chép các biến cần dùng vào `IOT-main/.env`, rồi khởi động lại backend. Trong dashboard, mở trang cảnh báo để bật email và đặt địa chỉ nhận. Không dùng mật khẩu đăng nhập email thường; hãy dùng thông tin SMTP/app password do nhà cung cấp email cấp.

### Trợ lý cục bộ (tùy chọn)

Trợ lý website dùng Ollama trên cùng máy với backend. Cài Ollama, tải model đã cấu hình trong `.env.example` (mặc định `qwen2.5:3b`) bằng `ollama pull qwen2.5:3b`, mở Ollama và khởi động lại backend. Xem `IOT-main/LOCAL_ASSISTANT.md` để biết dữ liệu nào được gửi cho model cục bộ.

## 4. Cài và nạp firmware Smart Home tích hợp

1. Cài Arduino IDE và board package ESP32 của Espressif; chọn đúng bo ESP32-S3 đang dùng.
2. Cài các thư viện Arduino: **IRremoteESP8266** (2.8.6 trở lên), **PubSubClient**, **LiquidCrystal_I2C**, **DHT sensor library** (Adafruit) và **Adafruit Unified Sensor** nếu Library Manager yêu cầu.
3. Mở sketch `SmartHome_AC_Integrated/SmartHome_AC_Integrated.ino` trong Arduino IDE. Giữ các file `.cpp`, `.h` trong cùng thư mục sketch.
4. Mở `SmartHome_AC_Integrated/config.h`, nhập Wi-Fi và MQTT broker của bạn vào `WIFI_SSID`, `WIFI_PASS`, `MQTT_HOST`, `MQTT_USER`, `MQTT_PASS`. Giữ nguyên cổng TLS `8883` và CA certificate nếu broker của bạn yêu cầu cấu hình mẫu này; nếu broker khác, cập nhật endpoint/chứng chỉ tương ứng.
5. Chọn board, cổng COM và nạp firmware. Mở Serial Monitor ở **115200 baud**.
6. Kiểm tra log Wi-Fi/MQTT và trạng thái thiết bị. Backend và ESP32 phải dùng cùng MQTT broker, thông tin đăng nhập và topic để website nhận dữ liệu/điều khiển thiết bị.

> Thư mục gốc có `config.h` riêng cho sketch `iot_ir_ac_hybrid.ino`. Nếu dùng firmware IR độc lập, hãy cập nhật file cấu hình ở thư mục gốc thay vì file cấu hình của sketch tích hợp.

## 5. Ghép điều khiển máy lạnh

Đưa remote máy lạnh về phía mắt thu IR. Trong Serial Monitor, nhập `pair`, sau đó bấm từng nút theo hướng dẫn hiện trên log: **Power ON**, **Temp Up**, **Temp Down**, **Power OFF**. Mỗi bước chỉ bấm một lần và chờ firmware nhận tín hiệu. Hồ sơ ghép được lưu trong NVS của ESP32 nên vẫn còn sau khi khởi động lại.

Các lệnh Serial thường dùng:

| Lệnh | Tác dụng |
|---|---|
| `pair` | Bắt đầu ghép remote máy lạnh |
| `status` | Xem trạng thái/hồ sơ IR đã lưu |
| `unpair` | Xóa hồ sơ ghép |
| `power on`, `power off` | Bật/tắt máy lạnh |
| `temp 26` | Yêu cầu làm lạnh ở 26°C (16–30°C) |
| `learn cool_26` | Học một phím nhiệt độ cho chế độ raw fallback |
| `F` | Bật/tắt relay quạt |
| `1`, `2`, `3` | Bật/tắt từng LED |

Firmware ưu tiên điều khiển semantic nếu nhận diện được giao thức máy lạnh. Với remote không giải mã được, firmware dùng raw fallback; cần học từng mức nhiệt muốn dùng, ví dụ `learn cool_26`. Xem `SmartHome_AC_Integrated/README.md` để biết thêm về ghép IR, MQTT và tự động hóa.

## 6. Website và MQTT

Khi backend, broker và ESP32 đã kết nối:

- Dashboard hiển thị cảm biến và trạng thái thiết bị.
- Trang máy lạnh gửi lệnh bật/tắt, chế độ, nhiệt độ và tốc độ quạt.
- Trang tự động hóa dùng dữ liệu cảm biến để điều khiển theo quy tắc.
- Trang cảnh báo cấu hình thông báo khói qua email.

Các MQTT topic được khai báo trong `IOT-main/config/mqttTopics.js` và firmware `config.h`. Mặc định gồm `smarthome/sensors/state`, `smarthome/ac/cmd`, `smarthome/ac/state`, `smarthome/device/cmd` và `smarthome/device/state`. Nếu đổi topic hoặc broker, cập nhật cả backend và firmware.

## 7. Sự cố thường gặp

- **Website không mở:** kiểm tra backend đã chạy chưa, cổng `3000` có bị ứng dụng khác dùng không.
- **Không đăng nhập được hoặc dữ liệu không lưu:** kiểm tra MongoDB đang chạy và `MONGODB_URI` chính xác.
- **ESP32 không lên MQTT:** kiểm tra Wi-Fi, host/port, username/password, TLS và CA certificate. Backend và ESP32 phải vào cùng broker.
- **Dashboard không thấy ESP32:** kiểm tra MQTT topics ở hai phía và xem Serial Monitor để biết thiết bị đã kết nối chưa.
- **Máy lạnh không phản hồi:** ghép lại với mắt thu hướng về remote; thử `status`. Nếu profile ở raw fallback, học slot đúng nhiệt độ trước khi gửi nhiệt độ đó.
- **Trợ lý báo không khả dụng:** chạy Ollama và kiểm tra model đã tải.

## 8. Bảo mật và triển khai

- Không commit `.env`, mật khẩu Wi-Fi/MQTT/SMTP, khóa API hoặc thông tin broker riêng.
- Các file `config.h` chỉ dùng placeholder trong bản chia sẻ; điền thông tin riêng trên máy của bạn.
- Đổi mật khẩu Wi-Fi/MQTT nếu từng bị đưa lên repo công khai hoặc chia sẻ ngoài ý muốn. Xóa giá trị khỏi file hiện tại không xóa chúng khỏi các commit cũ.
- Website này hướng dẫn chạy local. Trước khi mở ra Internet, cần tự cấu hình HTTPS, xác thực/kiểm soát truy cập, CORS, MongoDB và MQTT theo môi trường triển khai.
- Tài liệu firmware tích hợp ghi rõ bản tích hợp chưa được xác nhận build/test trên phần cứng; hãy biên dịch và kiểm tra an toàn trước khi triển khai thực tế.
