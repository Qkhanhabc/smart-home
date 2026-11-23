#include "mqtt_bridge.h"

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>
#include <string.h>

#include "config.h"

namespace {
WiFiClientSecure tlsClient;
PubSubClient mqttClient(tlsClient);
MqttMessageHandler messageHandler = nullptr;
uint32_t nextWifiAttemptMs = 0;
uint32_t nextMqttAttemptMs = 0;
uint32_t lastOnlinePublishMs = 0;

void receiveMqtt(char *topic, uint8_t *payload, unsigned int length)
{
  if (!messageHandler || !topic || length >= 384)
    return;
  char text[384];
  memcpy(text, payload, length);
  text[length] = '\0';
  messageHandler(topic, text);
}

void startWifiIfDue(uint32_t now)
{
  if (WiFi.status() == WL_CONNECTED || (int32_t)(now - nextWifiAttemptMs) < 0)
    return;
  nextWifiAttemptMs = now + 10000;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

void startMqttIfDue(uint32_t now)
{
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected() ||
      (int32_t)(now - nextMqttAttemptMs) < 0)
    return;

  // TLS validates certificate dates, so wait until asynchronous NTP has set the clock.
  if (time(nullptr) < 1700000000) {
    nextMqttAttemptMs = now + 2000;
    return;
  }

  nextMqttAttemptMs = now + 5000;
  const bool connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS,
                                             MQTT_TOPIC_DEVICE_STATUS, 1, true,
                                             "offline");
  if (connected)
  {
    mqttClient.subscribe(MQTT_TOPIC_AC_COMMAND, 1);
    mqttClient.subscribe(MQTT_TOPIC_AC_LEARN, 1);
    mqttClient.subscribe(MQTT_TOPIC_DEVICE_COMMAND, 1);
    mqttClient.publish(MQTT_TOPIC_DEVICE_STATUS, "online", true);
    lastOnlinePublishMs = now;
    Serial.println("[MQTT] connected over TLS; subscribed to AC command topics");
  }
  else if (ENABLE_DEBUG)
  {
    Serial.print("[MQTT] connect failed state=");
    Serial.println(mqttClient.state());
  }
}
} // namespace

void mqttBridgeBegin(MqttMessageHandler handler)
{
  messageHandler = handler;
  tlsClient.setCACert(MQTT_CA_CERT);
  mqttClient.setServer(MQTT_HOST, MQTT_TLS_PORT);
  mqttClient.setBufferSize(768);
  mqttClient.setKeepAlive(30);
  mqttClient.setCallback(receiveMqtt);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  nextWifiAttemptMs = millis() + 10000;
}

void mqttBridgeLoop()
{
  const uint32_t now = millis();
  startWifiIfDue(now);
  startMqttIfDue(now);
  if (mqttClient.connected())
  {
    mqttClient.loop();
    if (now - lastOnlinePublishMs >= 30000)
    {
      mqttClient.publish(MQTT_TOPIC_DEVICE_STATUS, "online", true);
      lastOnlinePublishMs = now;
    }
  }
}

bool mqttBridgePublish(const char *topic, const char *payload, bool retained)
{
  return mqttClient.connected() && topic && payload &&
         mqttClient.publish(topic, payload, retained);
}

bool mqttBridgeConnected()
{
  return mqttClient.connected();
}
