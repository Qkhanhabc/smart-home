const DEFAULT_DEVICES = Object.freeze({
  fan: {
    id: 'fan',
    label: 'Quạt',
    type: 'switch',
    stateKey: 'fan',
    aliases: ['quạt', 'quat'],
    physicalVerification: 'reported_by_esp32'
  },
  ac: {
    id: 'ac',
    label: 'Điều hòa',
    type: 'air_conditioner',
    stateKey: 'ac',
    aliases: ['điều hòa', 'dieu hoa', 'máy lạnh', 'may lanh'],
    physicalVerification: 'ir_command_only'
  },
  led1: {
    id: 'led1',
    label: 'Đèn 1',
    type: 'light',
    stateKey: 'led1',
    aliases: ['đèn', 'den', 'đèn 1', 'den 1', 'led 1'],
    physicalVerification: 'reported_by_esp32'
  },
  led2: {
    id: 'led2',
    label: 'Đèn 2',
    type: 'light',
    stateKey: 'led2',
    aliases: ['đèn 2', 'den 2', 'led 2'],
    physicalVerification: 'reported_by_esp32'
  },
  led3: {
    id: 'led3',
    label: 'Đèn 3',
    type: 'light',
    stateKey: 'led3',
    aliases: ['đèn 3', 'den 3', 'led 3'],
    physicalVerification: 'reported_by_esp32'
  }
});

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function readOverrides() {
  if (!process.env.DEVICE_LABELS_JSON) return {};
  try {
    const parsed = JSON.parse(process.env.DEVICE_LABELS_JSON);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error('DEVICE_LABELS_JSON không hợp lệ:', error.message);
    return {};
  }
}

function getDevices() {
  const overrides = readOverrides();
  return Object.values(DEFAULT_DEVICES).map((base) => {
    const custom = overrides[base.id] || {};
    return {
      ...base,
      label: typeof custom.label === 'string' && custom.label.trim() ? custom.label.trim() : base.label,
      room: typeof custom.room === 'string' && custom.room.trim() ? custom.room.trim() : null,
      aliases: [
        ...base.aliases,
        ...(Array.isArray(custom.aliases) ? custom.aliases.filter((item) => typeof item === 'string') : [])
      ]
    };
  });
}

function resolveDevice(value, room) {
  const query = normalizeText(value);
  const roomQuery = normalizeText(room);
  if (!query) return { device: null, reason: 'missing_device' };

  const candidates = getDevices().filter((device) => {
    const names = [device.id, device.label, ...device.aliases].map(normalizeText);
    const deviceMatch = names.includes(query) || names.some((name) => query === `${normalizeText(device.room)} ${name}`.trim());
    if (!deviceMatch) return false;
    return !roomQuery || normalizeText(device.room) === roomQuery;
  });

  if (candidates.length === 1) return { device: candidates[0] };
  if (candidates.length > 1) return { device: null, reason: 'ambiguous_device', candidates };
  return { device: null, reason: roomQuery ? 'unknown_room_or_device' : 'unknown_device' };
}

function getDeviceById(id) {
  return getDevices().find((device) => device.id === id) || null;
}

module.exports = { getDevices, getDeviceById, resolveDevice, normalizeText };
