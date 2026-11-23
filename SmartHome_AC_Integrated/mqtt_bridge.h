#pragma once

#include <Arduino.h>

typedef void (*MqttMessageHandler)(const char *topic, const char *payload);

void mqttBridgeBegin(MqttMessageHandler handler);
void mqttBridgeLoop();
bool mqttBridgePublish(const char *topic, const char *payload, bool retained = false);
bool mqttBridgeConnected();
