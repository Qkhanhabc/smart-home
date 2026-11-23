const mqtt = require('mqtt');
const dotenv = require('dotenv');
const EventEmitter = require('events');
const ActionData = require('../models/ActionData');
const AcRawSlot = require('../models/AcRawSlot');
const Settings = require('../models/Settings');
const emailService = require('./emailService');
const topics = require('../config/mqttTopics');

dotenv.config();

const MAX_ACTION_RECORDS = 2000;
const DEVICE_LABELS = { fan: 'quạt', ac: 'điều hòa', led1: 'đèn', led2: 'đèn 2', led3: 'đèn 3' };

function toOnOff(value) {
  if (value === true || value === 1 || value === '1') return 'ON';
  if (value === false || value === 0 || value === '0') return 'OFF';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['on', 'true', 'bat'].includes(normalized)) return 'ON';
    if (['off', 'false', 'tat'].includes(normalized)) return 'OFF';
  }
  return null;
}

class MQTTService extends EventEmitter {
  constructor() {
    super();
    this.ioInstance = null;
    this.currentDeviceStatus = { fan: 'OFF', ac: 'OFF', led1: 'OFF', led2: 'OFF', led3: 'OFF' };
    this.statusInitialized = { fan: false, ac: false, led1: false, led2: false, led3: false };
    this.currentAcState = null;
    this.latestSensorData = null;
    this.isOnline = false;
    this.automationSettings = null;
    this.automationTargets = { cooling: false, light: null };
    this.lastSmokeAlarm = false;

    const options = {
      host: process.env.MQTT_HOST,
      port: Number(process.env.MQTT_PORT || 8883),
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      protocol: 'mqtts',
      rejectUnauthorized: true
    };
    if (process.env.MQTT_CA_PATH) {
      options.ca = require('fs').readFileSync(process.env.MQTT_CA_PATH);
    }
    this.client = mqtt.connect(options);

    this.client.on('connect', () => {
      console.log('Kết nối MQTT/TLS thành công tới EMQX');
      this.client.subscribe([
        topics.sensorState,
        topics.acState,
        topics.deviceState,
        topics.deviceStatus
      ], { qos: 1 }, (error) => {
        if (error) console.error('Lỗi subscribe MQTT:', error.message);
      });
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message.toString()).catch((error) => {
        console.error(`Lỗi xử lý MQTT topic ${topic}:`, error);
      });
    });

    this.client.on('error', (error) => {
      console.error('Lỗi MQTT:', error.message);
    });
  }

  async handleMessage(topic, text) {
    if (topic === topics.sensorState) {
      await this.handleSensorState(text);
      return;
    }
    if (topic === topics.deviceState) {
      const data = JSON.parse(text);
      await this.updateDeviceStatus({ fan: data.fan, led1: data.led1, led2: data.led2, led3: data.led3 });
      return;
    }
    if (topic === topics.acState) {
      const data = JSON.parse(text);
      if (Object.prototype.hasOwnProperty.call(data, 'power') || data.control) {
        this.currentAcState = { ...(this.currentAcState || {}), ...data };
      }
      if (data.learn && data.status === 'saved') {
        await AcRawSlot.findOneAndUpdate(
          { name: data.learn },
          { name: data.learn, lastLearnedAt: new Date() },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      if (Object.prototype.hasOwnProperty.call(data, 'power')) {
        await this.updateDeviceStatus({ ac: data.power });
      }
      if (this.ioInstance) this.ioInstance.emit('acStateUpdate', data);
      this.emit('acStateUpdate', data);
      return;
    }
    if (topic === topics.deviceStatus) {
      this.isOnline = text.trim().toLowerCase() === 'online';
      const status = { online: this.isOnline };
      if (this.ioInstance) this.ioInstance.emit('deviceConnectionUpdate', status);
      this.emit('deviceConnectionUpdate', status);
    }
  }

  async handleSensorState(text) {
    const data = JSON.parse(text);
    const alarmValue = data.smoke_alarm ?? data.smokeAlarm;
    const alarmKnown = alarmValue !== undefined && alarmValue !== null;
    const smokeAlarm = alarmValue === true || alarmValue === 1 || ['true', '1', 'on'].includes(String(alarmValue).trim().toLowerCase());
    const formattedData = {
      temperature: data.temp_c ?? data.temperature ?? data.temp ?? null,
      humidity: data.humidity ?? data.humi ?? null,
      light: data.light ?? data.light_pct ?? null,
      mq2: data.mq2 ?? null,
      person: data.person ?? null,
      smokeAlarm: alarmKnown ? smokeAlarm : null,
      fanRelay: data.fan_relay ?? null,
      createdAt: new Date()
    };
    this.latestSensorData = formattedData;
    if (this.ioInstance) this.ioInstance.emit('newSensorData', formattedData);
    this.emit('newSensorData', formattedData);
    await this.runAutomation(formattedData);
    if (alarmKnown) {
      if (smokeAlarm && !this.lastSmokeAlarm) await this.sendSmokeAlarmEmail(formattedData);
      this.lastSmokeAlarm = smokeAlarm;
    }

    const statusUpdates = {};
    if (data.fan_relay !== undefined) statusUpdates.fan = data.fan_relay;
    if (Object.keys(statusUpdates).length) await this.updateDeviceStatus(statusUpdates);
  }

  async sendSmokeAlarmEmail(sensor) {
    try {
      if (!this.automationSettings) this.automationSettings = await Settings.findOne().lean();
      const settings = this.automationSettings;
      if (!settings || !settings.smokeEmailEnabled || !settings.smokeEmailTo) return;
      await emailService.sendSmokeAlert(settings.smokeEmailTo, sensor);
      const status = { sent: true, email: settings.smokeEmailTo, createdAt: sensor.createdAt };
      if (this.ioInstance) this.ioInstance.emit('smokeAlarmEmailStatus', status);
      this.emit('smokeAlarmEmailStatus', status);
    } catch (error) {
      console.error('Gửi cảnh báo khói qua email thất bại:', error.message);
      const status = { sent: false, message: error.message, createdAt: sensor.createdAt };
      if (this.ioInstance) this.ioInstance.emit('smokeAlarmEmailStatus', status);
      this.emit('smokeAlarmEmailStatus', status);
    }
  }

  async updateDeviceStatus(updates) {
    const changed = [];
    let shouldEmit = false;
    for (const [key, value] of Object.entries(updates)) {
      if (!Object.prototype.hasOwnProperty.call(this.currentDeviceStatus, key)) continue;
      const next = toOnOff(value);
      if (!next) continue;
      const previous = this.currentDeviceStatus[key];
      if (!this.statusInitialized[key] || previous !== next) shouldEmit = true;
      if (this.statusInitialized[key] && previous !== next) changed.push({ key, next });
      this.currentDeviceStatus[key] = next;
      this.statusInitialized[key] = true;
    }

    if (shouldEmit) {
      if (this.ioInstance) this.ioInstance.emit('deviceStatusUpdate', this.currentDeviceStatus);
      this.emit('deviceStatusUpdate', this.currentDeviceStatus);
    }

    for (const { key, next } of changed) await this.recordAction(key, next);
  }

  async recordAction(deviceKey, status) {
    const device = DEVICE_LABELS[deviceKey];
    if (!device) return;
    try {
      const count = await ActionData.countDocuments();
      if (count >= MAX_ACTION_RECORDS) {
        const oldestAction = await ActionData.findOne().sort({ time: 1 });
        if (oldestAction) await ActionData.deleteOne({ _id: oldestAction._id });
      }
      await new ActionData({ device, status: status.toLowerCase() }).save();
      if (this.ioInstance) this.ioInstance.emit('statsToggleUpdate');
    } catch (error) {
      console.error('Lỗi lưu lịch sử thiết bị vào MongoDB:', error);
    }
  }

  getCurrentDeviceStatus() {
    return { ...this.currentDeviceStatus };
  }

  getCurrentAcState() {
    return this.currentAcState ? { ...this.currentAcState } : null;
  }

  updateAutomationSettings(settings) {
    const previous = this.automationSettings;
    const next = settings ? settings.toObject ? settings.toObject() : { ...settings } : null;
    if (previous && next && this.client.connected) {
      if (previous.autoCoolingEnabled && !next.autoCoolingEnabled && this.automationTargets.cooling) {
        const mode = this.automationTargets.coolingMode || previous.autoCoolingMode || 'both';
        if (mode === 'fan' || mode === 'both') {
          this.client.publish(topics.deviceCommand, JSON.stringify({ device: 'fan', power: 0 }), { qos: 1 });
        }
        if (mode === 'ac' || mode === 'both') this.publishAcAutomationPower(false, previous);
        this.automationTargets.cooling = false;
      }
      if (previous.autoLightingEnabled && !next.autoLightingEnabled && this.automationTargets.light === true) {
        this.client.publish(topics.deviceCommand, JSON.stringify({ device: 'led1', power: 0 }), { qos: 1 });
        this.automationTargets.light = null;
      }
    }
    this.automationSettings = next;
  }

  async runAutomation(sensor) {
    if (!this.client.connected) return;
    if (!this.automationSettings) {
      try { this.automationSettings = await Settings.findOne().lean(); }
      catch (error) { console.error('Không tải được cài đặt tự động:', error.message); return; }
    }
    const settings = this.automationSettings;
    if (!settings) return;

    if (settings.autoCoolingEnabled && typeof sensor.person === 'boolean' && sensor.temperature !== null && Number.isFinite(Number(sensor.temperature))) {
      const threshold = Number(settings.autoTempThreshold ?? 30);
      const temp = Number(sensor.temperature);
      const cooling = sensor.person && (this.automationTargets.cooling ? temp > threshold - 1 : temp >= threshold);
      const mode = settings.autoCoolingMode || 'both';
      const previousMode = this.automationTargets.coolingMode;
      const modeChanged = !!previousMode && previousMode !== mode;
      if (cooling !== this.automationTargets.cooling || modeChanged) {
        const previousCooling = this.automationTargets.cooling;
        this.automationTargets.cooling = cooling;
        this.automationTargets.coolingMode = mode;
        const hadFan = previousMode === 'fan' || previousMode === 'both';
        const hadAc = previousMode === 'ac' || previousMode === 'both';
        const wantsFan = mode === 'fan' || mode === 'both';
        const wantsAc = mode === 'ac' || mode === 'both';
        if (modeChanged && hadFan && !wantsFan) {
          this.client.publish(topics.deviceCommand, JSON.stringify({ device: 'fan', power: 0 }), { qos: 1 });
        }
        if (modeChanged && hadAc && !wantsAc) this.publishAcAutomationPower(false, settings);
        if ((cooling || cooling !== previousCooling) && wantsFan) {
          this.client.publish(topics.deviceCommand, JSON.stringify({ device: 'fan', power: cooling ? 1 : 0 }), { qos: 1 });
        }
        if ((cooling || cooling !== previousCooling) && wantsAc) {
          if (cooling) {
            const acControl = this.currentAcState && this.currentAcState.control;
            if (acControl === 'semantic') {
              const command = { power: 1, mode: settings.autoAcMode || 'cool', temp: Number(settings.autoAcTemp ?? 26), fan: settings.autoAcFan || 'auto' };
              this.client.publish(topics.acCommand, JSON.stringify(command), { qos: 1 });
            } else if (acControl === 'raw') {
              this.client.publish(topics.acCommand, JSON.stringify({ slot: `cool_${Number(settings.autoAcTemp ?? 26)}` }), { qos: 1 });
            } else {
              console.warn('Tự động điều hòa chưa chạy: chưa có hồ sơ ghép nối AC.');
            }
          } else this.publishAcAutomationPower(false, settings);
        }
        if (this.ioInstance) this.ioInstance.emit('automationAction', { type: 'cooling', enabled: cooling, mode });
        this.emit('automationAction', { type: 'cooling', enabled: cooling, mode });
      }
    }

    if (settings.autoLightingEnabled && sensor.light !== null && Number.isFinite(Number(sensor.light))) {
      const threshold = Number(settings.autoLightThreshold ?? 1500);
      const lightIsOn = settings.autoLightDirection === 'above'
        ? Number(sensor.light) >= threshold
        : Number(sensor.light) <= threshold;
      if (lightIsOn !== this.automationTargets.light) {
        this.automationTargets.light = lightIsOn;
        this.client.publish(topics.deviceCommand, JSON.stringify({ device: 'led1', power: lightIsOn ? 1 : 0 }), { qos: 1 });
        if (this.ioInstance) this.ioInstance.emit('automationAction', { type: 'lighting', enabled: lightIsOn });
        this.emit('automationAction', { type: 'lighting', enabled: lightIsOn });
      }
    }
  }

  publishAcAutomationPower(active, settings) {
    const control = this.currentAcState && this.currentAcState.control;
    if (control === 'semantic') {
      this.client.publish(topics.acCommand, JSON.stringify(active
        ? { power: 1, mode: settings.autoAcMode || 'cool', temp: Number(settings.autoAcTemp ?? 26), fan: settings.autoAcFan || 'auto' }
        : { power: 0 }), { qos: 1 });
    } else if (control === 'raw') {
      this.client.publish(topics.acCommand, JSON.stringify({ slot: active ? `cool_${Number(settings.autoAcTemp ?? 26)}` : 'pw_of' }), { qos: 1 });
    } else if (active) console.warn('Tự động điều hòa chưa chạy: chưa có hồ sơ ghép nối AC.');
  }

  setIO(io) {
    this.ioInstance = io;
    io.on('connection', (socket) => {
      socket.emit('deviceStatusUpdate', this.getCurrentDeviceStatus());
      socket.emit('deviceConnectionUpdate', { online: this.isOnline });
      if (this.currentAcState) socket.emit('acStateUpdate', this.currentAcState);
      if (this.latestSensorData) socket.emit('newSensorData', this.latestSensorData);
    });
  }
}

const mqttService = new MQTTService();
module.exports = mqttService;
