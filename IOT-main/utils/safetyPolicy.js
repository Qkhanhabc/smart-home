function shouldBlockAutomaticFan({ deviceId, power, source, sensor }) {
  return deviceId === 'fan'
    && power === true
    && ['ai', 'automation', 'schedule', 'scene'].includes(source)
    && sensor?.smokeAlarm === true;
}

module.exports = { shouldBlockAutomaticFan };
