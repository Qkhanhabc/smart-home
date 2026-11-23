# Smart Home + AC IR integration

This is a separate Arduino sketch based on the supplied Smart Home code. Its
LCD, DHT11, MQ-2 alarm, radar/light inputs, LEDs, and fan relay sections are
preserved. The sample Toshiba raw waveform is kept in
`ac_sample_reference.h` for reference only; it is not included or transmitted.
AC signals are captured from the user's remote during pairing.

## Website automation

The website's Automation page evaluates the person, temperature, and light ADC
values received on `smarthome/sensors/state`. Cooling can target the AC, fan,
or both; the AC settings are used with semantic profiles. Raw fallback replays
the learned `cool_NN` slot for the configured set temperature and uses the
paired `pw_of` slot to switch off. Light automation controls LED1 and lets the
user choose whether the ADC must be below or above its threshold. The Node
server must remain connected to MQTT for these rules to run.

## Smoke and gas email alerts

The server sends one email when `smoke_alarm` changes from false to true; it
does not resend for every sensor sample while the alarm remains active. It is
armed again after the sensor reports normal. Configure SMTP on the web server
using `IOT-main/.env.mail.example`, then open `/alerts.html` to set the
recipient, enable alerts, and send a test email. SMTP credentials stay in the
server's `.env`; the recipient and enabled flag are stored in MongoDB.

## Wiring

The existing wiring is retained: IR receiver GPIO17, IR transmitter GPIO22,
DHT11 GPIO4, fan relay GPIO14, LCD I2C SDA/SCL GPIO26/27, MQ-2 GPIO32, buzzer
GPIO23, alarm LED GPIO25, status LEDs GPIO19/21/18, radar GPIO35, and light
sensor GPIO34. The AC module has been configured for GPIO17/22. Its original
feedback buzzer/LED hooks are disabled so they cannot interfere with the
Smart Home alarm pins.

## Pairing and controls

Open Serial Monitor at 115200 baud with line endings enabled. Enter `pair`,
then point the AC remote at the receiver and press **Power ON**, **Temp Up**,
**Temp Down**, and **Power OFF**, one press at a time. The saved profile is in
ESP32 NVS and survives reboot. `status` reports the selected protocol/control
mode; `unpair` clears that profile.

- `power on` / `power off` sends AC power commands (`B` / `T` also work).
- `temp 26` requests a cool target at 26 °C when semantic control is trusted.
- For raw fallback, `learn cool_26` captures a remote key; then `temp 26` can
  replay that slot. Raw fallback cannot synthesize temperatures that were not
  learned.
- Existing Smart Home serial controls remain: `1`, `2`, `3` toggle status LEDs;
  `F` toggles the fan relay.

## MQTT and website

The ESP32 and Node.js backend connect to the configured EMQX host over MQTT/TLS
port 8883. The website talks to the backend through its HTTP API and
Socket.IO. Topics are created implicitly when clients publish or subscribe.

| Topic | Direction | Payload |
|---|---|---|
| `smarthome/ac/cmd` | Website → ESP32 | `{"power":1,"mode":"cool","temp":26,"fan":"auto"}` |
| `smarthome/ac/learn` | Website → ESP32 | `{"slot":"cool_26"}`; ESP32 waits for one remote press |
| `smarthome/ac/state` | ESP32 → Website | AC state JSON, or a learning/command error status |
| `smarthome/device/cmd` | Website → ESP32 | `{"device":"fan","power":1}`; LED commands use `led1`, `led2`, or `led3` |
| `smarthome/device/state` | ESP32 → Website | Relay and all three LED states |
| `smarthome/sensors/state` | ESP32 → Website | temperature, humidity, light, MQ-2, radar, relay, alarm |
| `smarthome/device/status` | ESP32 → Website | retained `online` / `offline` |

For raw fallback, the website can request capture on `smarthome/ac/learn`, then
send `{"slot":"cool_26"}` to `smarthome/ac/cmd` to replay it. Semantic mode
accepts power, mode (`auto`, `cool`, `dry`, `fan`), temperature (16–30 °C),
and fan (`auto`, `low`, `medium`, `high`) in `smarthome/ac/cmd`.

Before flashing, fill in `WIFI_SSID`, `WIFI_PASS`, and `MQTT_PASS` in
`config.h`. The EMQX username is already set to `smarthome`; the supplied CA
certificate is embedded for TLS verification. Do not publish command messages
as retained messages, so an old command is not replayed when the ESP32 reconnects.

## Build dependencies

Use an ESP32-S3 Arduino board package, IRremoteESP8266 (v2.8.6 or later),
PubSubClient, LiquidCrystal_I2C, and DHT sensor library. Open this folder as
the sketch folder so Arduino compiles the included `.cpp` modules.

This integration has not been compiled or tested on hardware.
