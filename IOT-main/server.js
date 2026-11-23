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

// Cấu hình CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Cho phép cả hai origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware để parse JSON
app.use(express.json());

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
    origin: "*", // Bạn có thể thay đổi theo nhu cầu bảo mật
    methods: ["GET", "POST"]
  }
});
io.use(authController.authenticateSocket);

// Kết nối tới MongoDB
connectDB();

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
// Import và cấu hình MQTT Service
const mqttService = require('./services/mqttService');
mqttService.setIO(io);

// Khởi chạy Data Aggregation
const { startDataAggregation } = require('./utils/dataAggregator');
startDataAggregation(mqttService, io);

// Bắt đầu server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
