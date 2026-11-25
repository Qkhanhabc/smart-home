const Scene = require('../models/Scene');
const { normalizeText } = require('../config/deviceRegistry');
const deviceCommands = require('./deviceCommandService');

const DEFAULT_SCENES = [
  {
    key: 'sleep', name: 'Chế độ đi ngủ', aliases: ['đi ngủ', 'sleep mode'], builtIn: true,
    description: 'Tắt ba đèn và quạt; hệ thống cảnh báo vẫn hoạt động.',
    actions: ['led1', 'led2', 'led3', 'fan'].map((device) => ({ type: 'device', device, power: false }))
  },
  {
    key: 'away', name: 'Chế độ ra khỏi nhà', aliases: ['ra ngoài', 'away mode'], builtIn: true,
    description: 'Tắt ba đèn, quạt và gửi lệnh tắt điều hòa.',
    actions: [...['led1', 'led2', 'led3', 'fan'].map((device) => ({ type: 'device', device, power: false })), { type: 'air_conditioner', device: 'ac', power: false }]
  },
  {
    key: 'home', name: 'Chế độ về nhà', aliases: ['về nhà', 'home mode'], builtIn: true,
    description: 'Bật đèn 1. Có thể sửa cấu hình để phù hợp mô hình thực tế.',
    actions: [{ type: 'device', device: 'led1', power: true }]
  },
  {
    key: 'cooling', name: 'Chế độ làm mát', aliases: ['làm mát', 'cooling mode'], builtIn: true,
    description: 'Bật quạt. Không tự bật khi cảm biến đang cảnh báo khói/khí gas.',
    actions: [{ type: 'device', device: 'fan', power: true }]
  },
  {
    key: 'energy_saving', name: 'Chế độ tiết kiệm điện', aliases: ['tiết kiệm điện', 'energy saving mode'], builtIn: true,
    description: 'Tắt ba đèn đang kết nối.',
    actions: ['led1', 'led2', 'led3'].map((device) => ({ type: 'device', device, power: false }))
  }
];

async function ensureDefaultScenes() {
  for (const scene of DEFAULT_SCENES) {
    await Scene.updateOne({ key: scene.key }, { $setOnInsert: scene }, { upsert: true });
  }
}

async function findScene(value) {
  const query = normalizeText(value);
  const scenes = await Scene.find({ enabled: true }).lean();
  return scenes.find((scene) => [scene.key, scene.name, ...(scene.aliases || [])].some((name) => normalizeText(name) === query)) || null;
}

async function activateScene(value, options = {}) {
  const scene = await findScene(value);
  if (!scene) throw new Error(`Không tìm thấy kịch bản “${value}”.`);
  if (!scene.actions.length) return { ok: true, scene: scene.key, results: [], message: 'Kịch bản chưa có hành động nào.' };
  const results = [];
  for (const action of scene.actions) {
    try {
      const result = action.type === 'air_conditioner'
        ? await deviceCommands.controlAirConditioner({ power: action.power, mode: action.mode, temp: action.temp, fan: action.fan }, { ...options, source: 'scene' })
        : await deviceCommands.controlDevice(action, { ...options, source: 'scene' });
      results.push(result);
    } catch (error) {
      results.push({ ok: false, device: action.device, error: error.message, code: error.code });
    }
  }
  return { ok: results.every((item) => item.ok), scene: scene.key, name: scene.name, results };
}

module.exports = { DEFAULT_SCENES, ensureDefaultScenes, findScene, activateScene };
