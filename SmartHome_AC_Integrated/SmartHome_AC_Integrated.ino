/* 
  Code Tong Hop ESP32 Smart Home + LCD1602 + Relay Quat 5V + Bao Khoi MQ-2
  
  Danh sach chan GPIO:
  - Relay Quat 5V:          GPIO 14 (D14)  [Noi voi chan IN cua Relay]
  - LCD1602 I2C:            SDA -> D26, SCL -> D27
  - Cam bien MQ-2 (AO):     GPIO 32 (D32)
  - Coi bao dong (Active):   GPIO 23 (D23)
  - LED do bao dong:        GPIO 25 (D25)
  - LED 1, 2, 3:            GPIO 19, 21, 18
  - DHT11 (Nhiet do/Do am): GPIO 4  (D4)
  - Radar LD2410C:          GPIO 35 (D35)
  - Cam bien anh sang:      GPIO 34 (D34)
  - Mat thu IR / Phat IR:   GPIO 17 / GPIO 22
*/

#include <Arduino.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <stdlib.h>
#include <string.h>
#include "ac_hybrid_driver.h"
#include "ac_mqtt_handler.h"
#include "ac_onboarding.h"
#include "ac_profile.h"
#include "ac_protocol_probe.h"
#include "ac_raw_store.h"
#include "ac_state_model.h"
#include "ir_feedback.h"
#include "ir_transport.h"
#include "mqtt_bridge.h"

// 1. Khai bao chan linh kien
const int FAN_PIN = 14;       // Chan dieu khien Relay Quat (High Level Trigger)
const int MQ2_PIN = 32;       // Chan doc Analog tu MQ-2
const int BUZZER_PIN = 23;    // Chan coi bao dong
const int ALARM_LED_PIN = 25; // Chan LED do bao dong

const int LED1_PIN = 19;
const int LED2_PIN = 21;
const int LED3_PIN = 18;

const int DHT_PIN = 4;
const int RADAR_PIN = 35;
const int LIGHT_PIN = 34;

const uint16_t IR_RECV_PIN = 17;
const uint16_t IR_SEND_PIN = 22;

// Nguong phat hien
const int MQ2_THRESHOLD = 1200;        // Nguong khoi/ga

LiquidCrystal_I2C lcd(0x27, 16, 2); 
DHT dht(DHT_PIN, DHT11);

unsigned long lastSensorReadTime = 0;
unsigned long lastSensorMonitorPrintTime = 0;
unsigned long lastBuzzerToggle = 0;
bool buzzerState = false;
bool fanState = false;
bool acLearnPending = false;
char acLearnName[AC_IR_MAX_SLOT_NAME + 1] = {};
bool lastMqttConnected = false;

static bool readJsonField(const char *json, const char *key, char *out, size_t outSize,
                          bool requireString)
{
  char token[32];
  snprintf(token, sizeof(token), "\"%s\"", key);
  const char *p = strstr(json, token);
  if (!p || !(p = strchr(p, ':')) || outSize == 0) return false;
  while (*++p == ' ' || *p == '\t') {}
  const bool quoted = (*p == '"');
  if (requireString && !quoted) return false;
  if (quoted) ++p;
  size_t n = 0;
  while (p[n] && (quoted ? p[n] != '"' : p[n] != ',' && p[n] != '}' && p[n] != ' ')) ++n;
  if (n == 0) return false;
  if (n >= outSize) n = outSize - 1;
  memcpy(out, p, n); out[n] = '\0';
  return true;
}

static void publishMqttStatus(const char *json)
{
  mqttBridgePublish(MQTT_TOPIC_AC_STATE, json, false);
}

static void publishHomeDeviceState()
{
  char payload[128];
  snprintf(payload, sizeof(payload), "{\"fan\":\"%s\",\"led1\":\"%s\",\"led2\":\"%s\",\"led3\":\"%s\"}",
           digitalRead(FAN_PIN) ? "ON" : "OFF",
           digitalRead(LED1_PIN) ? "ON" : "OFF",
           digitalRead(LED2_PIN) ? "ON" : "OFF",
           digitalRead(LED3_PIN) ? "ON" : "OFF");
  mqttBridgePublish(MQTT_TOPIC_DEVICE_STATE, payload, true);
}

static void startMqttLearn(const char *payload)
{
  char deleteSlot[AC_IR_MAX_SLOT_NAME + 1] = {};
  if (readJsonField(payload, "delete", deleteSlot, sizeof(deleteSlot), true)) {
    char response[96];
    if (acRawStoreRemove(deleteSlot))
      snprintf(response, sizeof(response), "{\"learn\":\"%s\",\"status\":\"deleted\"}", deleteSlot);
    else
      snprintf(response, sizeof(response), "{\"learn\":\"%s\",\"status\":\"not_found\"}", deleteSlot);
    publishMqttStatus(response);
    return;
  }

  char slot[AC_IR_MAX_SLOT_NAME + 1] = {};
  if (!readJsonField(payload, "slot", slot, sizeof(slot), true)) {
    const size_t n = strlen(payload);
    if (n > 0 && n < sizeof(slot)) memcpy(slot, payload, n + 1);
  }
  if (!slot[0] || acOnboarding.isActive()) {
    publishMqttStatus("{\"learn\":\"failed\",\"reason\":\"empty_slot_or_pairing_busy\"}");
    return;
  }
  strncpy(acLearnName, slot, sizeof(acLearnName) - 1);
  acLearnName[sizeof(acLearnName) - 1] = '\0';
  acLearnPending = true;
  char response[96];
  snprintf(response, sizeof(response), "{\"learn\":\"%s\",\"status\":\"waiting_for_remote\"}", acLearnName);
  publishMqttStatus(response);
}

static void handleMqttMessage(const char *topic, const char *payload)
{
  if (strcmp(topic, MQTT_TOPIC_DEVICE_COMMAND) == 0) {
    char device[16] = {}, value[16] = {};
    if (!readJsonField(payload, "device", device, sizeof(device), true) ||
        !readJsonField(payload, "power", value, sizeof(value), false)) {
      publishMqttStatus("{\"error\":\"invalid_device_command\"}"); return;
    }
    const bool on = strcmp(value, "true") == 0 || strcmp(value, "on") == 0 || atoi(value) != 0;
    if (strcmp(device, "fan") == 0) {
      fanState = on;
      digitalWrite(FAN_PIN, on ? HIGH : LOW);
    } else if (strcmp(device, "led1") == 0) {
      digitalWrite(LED1_PIN, on ? HIGH : LOW);
    } else if (strcmp(device, "led2") == 0) {
      digitalWrite(LED2_PIN, on ? HIGH : LOW);
    } else if (strcmp(device, "led3") == 0) {
      digitalWrite(LED3_PIN, on ? HIGH : LOW);
    } else {
      publishMqttStatus("{\"error\":\"unknown_device\"}"); return;
    }
    publishHomeDeviceState();
    return;
  }
  if (strcmp(topic, MQTT_TOPIC_AC_LEARN) == 0) {
    startMqttLearn(payload);
    return;
  }
  if (strcmp(topic, MQTT_TOPIC_AC_COMMAND) != 0) return;

  char value[32] = {};
  if (readJsonField(payload, "pair", value, sizeof(value), false)) {
    const bool start = strcmp(value, "true") == 0 || strcmp(value, "1") == 0;
    if (start && acOnboarding.start())
      publishMqttStatus("{\"pairing\":\"started\",\"steps\":\"power_on,temp_up,temp_down,power_off\"}");
    else
      publishMqttStatus("{\"pairing\":\"failed\",\"reason\":\"busy_or_invalid\"}");
    return;
  }
  if (readJsonField(payload, "learn", value, sizeof(value), true)) {
    char request[64];
    snprintf(request, sizeof(request), "{\"slot\":\"%s\"}", value);
    startMqttLearn(request);
    return;
  }
  if (readJsonField(payload, "slot", value, sizeof(value), true)) {
    if (acHybridDriver.sendSlotRaw(value)) {
      char result[96];
      snprintf(result, sizeof(result), "{\"raw_slot\":\"%s\",\"status\":\"sent\"}", value);
      publishMqttStatus(result);
    } else publishMqttStatus("{\"error\":\"raw_slot_not_found\"}");
    return;
  }

  AcClimateState target = acStateModel.climate();
  bool hasPower = false, hasMode = false, hasTemp = false, hasFan = false;
  if (readJsonField(payload, "power", value, sizeof(value), false)) {
    hasPower = true;
    target.power = strcmp(value, "true") == 0 || strcmp(value, "on") == 0 || atoi(value) != 0;
  }
  if (readJsonField(payload, "mode", value, sizeof(value), true)) {
    hasMode = true; target.power = true;
    if (strcmp(value, "auto") == 0) target.mode = stdAc::opmode_t::kAuto;
    else if (strcmp(value, "cool") == 0) target.mode = stdAc::opmode_t::kCool;
    else if (strcmp(value, "dry") == 0) target.mode = stdAc::opmode_t::kDry;
    else if (strcmp(value, "fan") == 0) target.mode = stdAc::opmode_t::kFan;
    else { publishMqttStatus("{\"error\":\"invalid_mode\"}"); return; }
  }
  if (readJsonField(payload, "temp", value, sizeof(value), false)) {
    hasTemp = true; target.power = true; target.tempC = (float)atoi(value);
  }
  if (readJsonField(payload, "fan", value, sizeof(value), true)) {
    hasFan = true;
    if (strcmp(value, "auto") == 0) target.fan = stdAc::fanspeed_t::kAuto;
    else if (strcmp(value, "low") == 0) target.fan = stdAc::fanspeed_t::kMin;
    else if (strcmp(value, "medium") == 0) target.fan = stdAc::fanspeed_t::kMedium;
    else if (strcmp(value, "high") == 0) target.fan = stdAc::fanspeed_t::kMax;
    else { publishMqttStatus("{\"error\":\"invalid_fan\"}"); return; }
  }
  if (!(hasPower || hasMode || hasTemp || hasFan)) return;
  if (acOnboarding.isActive()) {
    publishMqttStatus("{\"error\":\"pairing_in_progress\"}"); return;
  }
  if (hasTemp && (target.tempC < AC_TEMP_MIN || target.tempC > AC_TEMP_MAX)) {
    publishMqttStatus("{\"error\":\"temperature_out_of_range\"}"); return;
  }
  const AcDeviceProfile &profile = acProfileStore.cached();
  if (profile.mode == AcControlMode::kRawFallback && (hasMode || hasFan)) {
    publishMqttStatus("{\"error\":\"raw_fallback_requires_learned_slot\"}"); return;
  }
  if (profile.mode == AcControlMode::kRawFallback && hasTemp) {
    char slot[16]; snprintf(slot, sizeof(slot), "cool_%d", (int)target.tempC);
    if (!acRawStoreExists(slot)) {
      publishMqttStatus("{\"error\":\"learned_temperature_slot_missing\"}"); return;
    }
  }
  bool ok = hasPower && !hasMode && !hasTemp && !hasFan
                ? acHybridDriver.sendPower(target.power)
                : acHybridDriver.applyClimate(target);
  if (ok) acMqttPublishFullState();
  else publishMqttStatus("{\"error\":\"command_failed_check_pair_or_learned_slot\"}");
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // Khoi tao I2C va LCD
  Wire.begin(26, 27);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print(" SMART HOME ESP ");
lcd.setCursor(0, 1);
  lcd.print(" RELAY QUAT: D14");
  delay(1500);
  lcd.clear();

  // Cau hinh Output
  pinMode(FAN_PIN, OUTPUT);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  pinMode(LED3_PIN, OUTPUT);
  pinMode(ALARM_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(FAN_PIN, LOW);       // Quat TAT ban dau
  digitalWrite(LED1_PIN, LOW);
  digitalWrite(LED2_PIN, LOW);
  digitalWrite(LED3_PIN, LOW);
  digitalWrite(ALARM_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, HIGH); 

  pinMode(RADAR_PIN, INPUT);

  dht.begin();
  irTransport.begin();
  irTransport.enableRx();
  irFeedback.begin();
  acOnboarding.begin();
  acHybridDriver.begin();
  mqttBridgeBegin(handleMqttMessage);

  Serial.println("\n--- HE THONG SAN SANG (TICH HOP DIEU KHIEN QUAT RELAY) ---");
  Serial.println("Lenh: 1/2/3 LED, F quat, pair/status/unpair, power on|off, raw on|off, temp 26");
}

void loop() {
  // 1. XU LY BAO DONG MQ-2 (uu tien cao nhat)
  int mq2Val = analogRead(MQ2_PIN);

  if (mq2Val > MQ2_THRESHOLD) {
    digitalWrite(ALARM_LED_PIN, HIGH);
    
    // Coi keu tit tit
    if (millis() - lastBuzzerToggle >= 100) {
      lastBuzzerToggle = millis();
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW); 
    }
  } else {
    digitalWrite(ALARM_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, HIGH);
  }

  // 2. CAP NHAT CAM BIEN & TU DONG BAT QUAT THEO NHIET DO
  if (millis() - lastSensorReadTime >= 1500) {
    lastSensorReadTime = millis();

    int isPerson = digitalRead(RADAR_PIN);
    int lightVal = analogRead(LIGHT_PIN);
    float t = dht.readTemperature();
    float h = dht.readHumidity();

    // Hien thi LCD - Hang 0: Nhiet do & Do am
    lcd.setCursor(0, 0);
    if (isnan(t) || isnan(h)) {
      lcd.print("T:ERR   H:ERR   ");
    } else {
      lcd.print("T:"); lcd.print(t, 1); lcd.print((char)223); lcd.print("C H:"); lcd.print((int)h); lcd.print("%   ");
    }

    // Hien thi LCD - Hang 1: Trang thai Quat hoac Canh bao Khoi
    lcd.setCursor(0, 1);
    if (mq2Val > MQ2_THRESHOLD) {
      lcd.print("!CANH BAO KHOI! ");
    } else {
      lcd.print("S:"); lcd.print(lightVal);
      lcd.print(digitalRead(FAN_PIN) ? " Q:BAT " : " Q:TAT ");
      lcd.print("   ");
    }

    // In Serial Monitor once per minute; sensor sampling and MQTT remain responsive.
    if (millis() - lastSensorMonitorPrintTime >= 60000) {
      lastSensorMonitorPrintTime = millis();
      Serial.print("[Sensor] MQ2: "); Serial.print(mq2Val);
      Serial.print(" | Light: "); Serial.print(lightVal);
      Serial.print(" | DHT11: "); Serial.print(t); Serial.print("C, "); Serial.print(h); Serial.print("%");
      Serial.print(" | Quat(D14): "); Serial.print(digitalRead(FAN_PIN) ? "BAT" : "TAT");
      Serial.print(" | Radar nguoi(GPIO35): "); Serial.println(isPerson ? "PHAT HIEN" : "KHONG");
    }

    char sensorPayload[192];
    char tempText[16], humidityText[16];
    if (isnan(t)) strcpy(tempText, "null"); else snprintf(tempText, sizeof(tempText), "%.1f", (double)t);
    if (isnan(h)) strcpy(humidityText, "null"); else snprintf(humidityText, sizeof(humidityText), "%.1f", (double)h);
    snprintf(sensorPayload, sizeof(sensorPayload),
             "{\"temp_c\":%s,\"humidity\":%s,\"light\":%d,\"mq2\":%d,\"person\":%s,\"fan_relay\":%s,\"smoke_alarm\":%s}",
             tempText, humidityText, lightVal, mq2Val,
             isPerson ? "true" : "false", digitalRead(FAN_PIN) ? "true" : "false",
             mq2Val > MQ2_THRESHOLD ? "true" : "false");
    mqttBridgePublish(MQTT_TOPIC_SENSORS_STATE, sensorPayload, true);
    publishHomeDeviceState();
  }

  // 3. IR receive, pairing, and remote-state synchronization
  irTransport.poll();
  acOnboarding.poll();
  if (acLearnPending) {
    AcIrFrame learned = {};
    if (irTransport.pollCapture(&learned)) {
      Serial.println(acHybridDriver.learnRawSlot(acLearnName, learned) ? "[AC] Raw slot saved" : "[AC] Raw slot save failed");
      char result[96];
      snprintf(result, sizeof(result), "{\"learn\":\"%s\",\"status\":\"saved\"}", acLearnName);
      publishMqttStatus(result);
      acLearnPending = false;
    }
  }
  AcClimateState remoteState = {};
  const char *rawSlot = nullptr;
  if (acHybridDriver.pollRemoteSync(&remoteState, &rawSlot)) {
    Serial.print("[AC RX] power="); Serial.print(remoteState.power ? "ON" : "OFF");
    Serial.print(" temp="); Serial.print(remoteState.tempC, 0);
    Serial.print(" mode="); Serial.print((int)remoteState.mode);
    Serial.print(" fan="); Serial.println((int)remoteState.fan);
    acMqttPublishFullState();
  }
  irFeedback.poll();
  mqttBridgeLoop();
  const bool mqttConnected = mqttBridgeConnected();
  if (mqttConnected && !lastMqttConnected) {
    acMqttPublishFullState();
    publishHomeDeviceState();
  }
  lastMqttConnected = mqttConnected;

  // 4. Serial controls. Existing single-key controls remain available;
  //    AC pairing and climate commands use a full line.
  if (Serial.available() > 0) {
    char line[48] = {};
    size_t n = Serial.readBytesUntil('\n', line, sizeof(line) - 1);
    line[n] = '\0';
    while (n > 0 && (line[n - 1] == '\r' || line[n - 1] == ' ')) line[--n] = '\0';
    if (strcmp(line, "1") == 0) {
      digitalWrite(LED1_PIN, !digitalRead(LED1_PIN));
      Serial.println("=> Dao LED 1");
      publishHomeDeviceState();
    }
    else if (strcmp(line, "2") == 0) {
      digitalWrite(LED2_PIN, !digitalRead(LED2_PIN));
      Serial.println("=> Dao LED 2");
      publishHomeDeviceState();
    }
    else if (strcmp(line, "3") == 0) {
      digitalWrite(LED3_PIN, !digitalRead(LED3_PIN));
      Serial.println("=> Dao LED 3");
      publishHomeDeviceState();
    }
    else if (strcmp(line, "F") == 0 || strcmp(line, "f") == 0) { // Fan relay manual toggle
      fanState = !fanState;
      digitalWrite(FAN_PIN, fanState ? HIGH : LOW);
      Serial.println(fanState ? "=> Da BAT Quat (Relay D14)" : "=> Da TAT Quat (Relay D14)");
      publishHomeDeviceState();
    }
    else if (strcmp(line, "pair") == 0) {
      Serial.println(acOnboarding.start() ? "[AC] Pairing started: ON, TEMP UP, TEMP DOWN, OFF" : "[AC] Pairing busy");
    }
    else if (strcmp(line, "status") == 0) {
      const AcDeviceProfile &p = acProfileStore.cached();
      Serial.print("[AC] mode="); Serial.print((int)p.mode);
      Serial.print(" vendor="); Serial.print(acProtocolName(p.vendor));
      Serial.print(" confidence="); Serial.println(p.probeConfidence);
    }
    else if (strcmp(line, "unpair") == 0) {
      acProfileStore.clear(); acHybridDriver.begin(); Serial.println("[AC] Profile cleared");
    }
    else if (strncmp(line, "learn ", 6) == 0) {
      strncpy(acLearnName, line + 6, sizeof(acLearnName) - 1);
      acLearnName[sizeof(acLearnName) - 1] = '\0'; acLearnPending = acLearnName[0] != '\0';
      Serial.println(acLearnPending ? "[AC] Point remote and press the desired key" : "[AC] Slot name required");
    }
    else if (strcmp(line, "raw on") == 0) {
      Serial.println(acHybridDriver.sendSlotRaw("pw_on") ? "[AC] Raw POWER ON replay sent" : "[AC] Raw POWER ON frame unavailable; pair again first");
    }
    else if (strcmp(line, "raw off") == 0) {
      Serial.println(acHybridDriver.sendSlotRaw("pw_of") ? "[AC] Raw POWER OFF replay sent" : "[AC] Raw POWER OFF frame unavailable; pair again first");
    }
    else if (strcmp(line, "power on") == 0 || strcmp(line, "B") == 0 || strcmp(line, "b") == 0) {
      Serial.println(acHybridDriver.sendPower(true) ? "[AC] Power ON sent" : "[AC] Failed: pair first");
    }
    else if (strcmp(line, "power off") == 0 || strcmp(line, "T") == 0 || strcmp(line, "t") == 0) {
      Serial.println(acHybridDriver.sendPower(false) ? "[AC] Power OFF sent" : "[AC] Failed: pair first");
    }
    else if (strncmp(line, "temp ", 5) == 0) {
      AcClimateState target = acStateModel.climate(); target.power = true;
      target.mode = stdAc::opmode_t::kCool; target.tempC = (float)atoi(line + 5);
      Serial.println(acHybridDriver.applyClimate(target) ? "[AC] Temperature sent" : "[AC] Failed: pair or learn slot first");
    }
  }
}
