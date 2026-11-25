// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cors = require('cors'); // Import cors

// Load biến môi trường
dotenv.config();

// Khởi tạo ứng dụng Express
const app = express();
const allowedOrigins = [...new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.PUBLIC_BASE_URL
].filter(Boolean))];

// Cấu hình CORS
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware để parse JSON
app.use(express.json({ limit: '32kb' }));

// Parse only the session cookie; credentials and session tokens stay out of localStorage.
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }));
  next();
});

const authController = require('./controllers/authController');
app.use('/api/auth', require('./routes/authRoutes'));
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/auth')) return next();
  if (req.path.startsWith('/api/')) return authController.requireAuth(req, res, next);
  if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html')) && !['/login.html', '/register.html', '/forgot-password.html', '/reset-password.html'].includes(req.path)) {
    try { if (!await authController.hasSession(req)) return res.redirect('/login.html'); }
    catch (error) { return next(error); }
  }
  next();
});

// Phục vụ các file tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Tạo HTTP server
const server = http.createServer(app);

// Khởi tạo Socket.io với CORS đã cấu hình
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});
io.use(authController.authenticateSocket);

// Import các routes
const statusRoutes = require('./routes/statusRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const controlRoutes = require('./routes/controlRoutes');
const actionRoutes = require('./routes/actionRoutes');
const statsRoutes = require('./routes/statsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const acRoutes = require('./routes/acRoutes');
const alertRoutes = require('./routes/alertRoutes');
const anomalyRoutes = require('./routes/anomalyRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const automationRoutes = require('./routes/automationRoutes');
// Sử dụng các routes
app.use('/api/status-data', statusRoutes);  // Cập nhật status cho các device ở index.html
app.use('/api/sensor-data', sensorRoutes); // lấy dữ liệu cảm biến
app.use('/api/control', controlRoutes); // Gửi post api gửi cho hardware điều kiển thiết bị
app.use('/api/action',actionRoutes); // Lấy dữ liệu trạng thái của thiết bị
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ac', acRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/automations', automationRoutes);

app.use((error, _req, res, _next) => {
  console.error('Lỗi API chưa xử lý:', error);
  if (res.headersSent) return;
  res.status(500).json({ message: 'Lỗi máy chủ.' });
});
// Import và cấu hình MQTT Service
const mqttService = require('./services/mqttService');
const { startDataAggregation } = require('./utils/dataAggregator');
const { startAutomationEngine } = require('./services/automationEngine');
const { ensureDefaultScenes } = require('./services/sceneService');

// Bắt đầu server
const PORT = process.env.PORT || 3000;
async function start() {
  await connectDB();
  await ensureDefaultScenes();
  mqttService.setIO(io);
  startDataAggregation(mqttService, io);
  startAutomationEngine(mqttService, io);
  server.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));
}

start().catch((error) => {
  console.error('Không thể khởi động backend:', error);
  process.exit(1);
});
