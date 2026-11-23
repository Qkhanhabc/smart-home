const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function createTransport() {
  if (!isConfigured()) throw new Error('Chưa cấu hình SMTP_HOST, SMTP_USER và SMTP_PASSWORD trong .env');
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
}

async function sendMail(to, subject, text) {
  if (!to) throw new Error('Chưa nhập email nhận cảnh báo');
  const transporter = createTransport();
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text
  });
}

async function sendSmokeAlert(to, sensor) {
  const time = new Date(sensor.createdAt || Date.now()).toLocaleString('vi-VN', { timeZone: process.env.TZ || 'Asia/Ho_Chi_Minh' });
  const temp = sensor.temperature === null || sensor.temperature === undefined ? 'Không có dữ liệu' : `${sensor.temperature} °C`;
  const humidity = sensor.humidity === null || sensor.humidity === undefined ? 'Không có dữ liệu' : `${sensor.humidity}%`;
  const text = [
    'CẢNH BÁO KHÓI / KHÍ GAS - SMART HOME',
    '',
    `Thời gian: ${time}`,
    `Giá trị MQ-2: ${sensor.mq2 ?? 'Không có dữ liệu'}`,
    `Nhiệt độ: ${temp}`,
    `Độ ẩm: ${humidity}`,
    '',
    'Hệ thống đang phát cảnh báo tại thiết bị. Hãy kiểm tra khu vực và thông gió an toàn.'
  ].join('\n');
  return sendMail(to, '[Smart Home] Cảnh báo khói / khí gas', text);
}

async function sendTestEmail(to) {
  return sendMail(to, '[Smart Home] Email kiểm tra', 'Email kiểm tra gửi thành công từ hệ thống Smart Home.');
}

async function sendPasswordReset(to, resetUrl) {
  const text = [
    'YÊU CẦU ĐẶT LẠI MẬT KHẨU - SMART HOME',
    '',
    'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản dùng email này.',
    'Mở liên kết bên dưới trong vòng 15 phút để tạo mật khẩu mới:',
    '',
    resetUrl,
    '',
    'Liên kết chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.'
  ].join('\n');
  return sendMail(to, '[Smart Home] Đặt lại mật khẩu', text);
}

module.exports = { isConfigured, sendSmokeAlert, sendTestEmail, sendPasswordReset };
