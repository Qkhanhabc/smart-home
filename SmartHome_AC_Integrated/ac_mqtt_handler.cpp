#include "ac_mqtt_handler.h"

#include "ac_hybrid_driver.h"
#include "ac_protocol_probe.h"
#include "ac_state_model.h"
#include "config.h"
#include "mqtt_bridge.h"

namespace {
const char *modeName(stdAc::opmode_t mode)
{
  switch (mode)
  {
  case stdAc::opmode_t::kAuto: return "auto";
  case stdAc::opmode_t::kDry: return "dry";
  case stdAc::opmode_t::kFan: return "fan";
  default: return "cool";
  }
}

const char *fanName(stdAc::fanspeed_t fan)
{
  switch (fan)
  {
  case stdAc::fanspeed_t::kMin:
  case stdAc::fanspeed_t::kLow: return "low";
  case stdAc::fanspeed_t::kMedium:
  case stdAc::fanspeed_t::kMediumHigh: return "medium";
  case stdAc::fanspeed_t::kHigh:
  case stdAc::fanspeed_t::kMax: return "high";
  default: return "auto";
  }
}
}

void acMqttInit(DtgWiFi *) {}
void acMqttPublishFullState()
{
  const AcClimateState &state = acStateModel.climate();
  const AcDeviceProfile &profile = acHybridDriver.profile();
  const char *control = profile.mode == AcControlMode::kSemantic ? "semantic"
                        : profile.mode == AcControlMode::kRawFallback ? "raw" : "none";
  const char *vendor = profile.vendor == UNKNOWN ? "unknown" : acProtocolName(profile.vendor);
  char payload[256];
  snprintf(payload, sizeof(payload),
           "{\"power\":%u,\"mode\":\"%s\",\"temp\":%.0f,\"fan\":\"%s\",\"control\":\"%s\",\"vendor\":\"%s\"}",
           state.power ? 1 : 0, modeName(state.mode), static_cast<double>(state.tempC),
           fanName(state.fan), control, vendor);
  mqttBridgePublish(MQTT_TOPIC_AC_STATE, payload, true);
}
void acMqttPublishEvent(const char *json)
{
  if (json) mqttBridgePublish(MQTT_TOPIC_AC_STATE, json, false);
}
void acMqttOnConnected() {}
void acMqttPollRemoteSync() {}
void acMqttHandleCommand(const char *, const char *, const uint8_t *, unsigned int) {}
