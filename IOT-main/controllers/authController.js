const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const PasswordResetToken = require('../models/PasswordResetToken');
const emailService = require('../services/emailService');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'smarthome_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_MS = 15 * 60 * 1000;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const resetRequests = new Map();

function allowResetRequest(key, maxRequests, windowMs) {
  const now = Date.now();
  if (resetRequests.size > 5000) {
    for (const [savedKey, times] of resetRequests) {
      if (!times.length || now - times[times.length - 1] > 60 * 60 * 1000) resetRequests.delete(savedKey);
    }
  }
  const recent = (resetRequests.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= maxRequests) return false;
  recent.push(now);
  resetRequests.set(key, recent);
  return true;
}

function cookieOptions(maxAge) {
  return { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge };
}

async function getSession(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  const session = await AuthSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).populate('userId', 'username fullName email createdAt');
  return session ? { session, user: session.userId } : null;
}

exports.hasSession = async (req) => Boolean(await getSession(req));

exports.register = async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (fullName.length < 2 || fullName.length > 80) return res.status(400).json({ message: 'Họ tên cần từ 2 đến 80 ký tự.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: 'Địa chỉ email không hợp lệ.' });
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ message: 'Tên đăng nhập cần 3–32 ký tự (chữ thường, số, ., _, -).' });
    if (password.length < 10 || password.length > 128) return res.status(400).json({ message: 'Mật khẩu cần từ 10 đến 128 ký tự.' });
    const salt = crypto.randomBytes(16);
    const passwordHash = await scrypt(password, salt, 64);
    if (password !== String(req.body.confirmPassword || '')) return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
    const user = await User.create({ username, fullName, email, passwordSalt: salt.toString('hex'), passwordHash: passwordHash.toString('hex') });
    await createSession(user, res);
    return res.status(201).json({ username: user.username });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: error.keyPattern?.email ? 'Email này đã được đăng ký.' : 'Tên đăng nhập đã được sử dụng.' });
    console.error('Đăng ký thất bại:', error);
    return res.status(500).json({ message: 'Không thể tạo tài khoản lúc này.' });
  }
};

async function createSession(user, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  await AuthSession.create({ tokenHash: hashToken(token), userId: user._id, expiresAt: new Date(Date.now() + SESSION_MS) });
  res.cookie(COOKIE, token, cookieOptions(SESSION_MS));
}

exports.login = async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    const expected = Buffer.from(user.passwordHash, 'hex');
    const actual = await scrypt(password, Buffer.from(user.passwordSalt, 'hex'), expected.length);
    if (!crypto.timingSafeEqual(expected, actual)) return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    await createSession(user, res);
    return res.json({ username: user.username });
  } catch (error) {
    console.error('Đăng nhập thất bại:', error);
    return res.status(500).json({ message: 'Không thể đăng nhập lúc này.' });
  }
};

exports.forgotPassword = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const genericMessage = 'Nếu email này thuộc một tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi nếu email đã được cấu hình.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
  }

  const ip = req.socket?.remoteAddress || 'unknown';
  if (!allowResetRequest(`ip:${ip}`, 10, 15 * 60 * 1000) || !allowResetRequest(`email:${email}`, 3, 60 * 60 * 1000)) {
    return res.json({ message: genericMessage });
  }

  try {
    const user = await User.findOne({ email });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      await PasswordResetToken.deleteMany({ userId: user._id });
      await PasswordResetToken.create({
        tokenHash: hashToken(rawToken),
        userId: user._id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_MS)
      });
      const baseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const resetUrl = `${baseUrl}/reset-password.html?token=${encodeURIComponent(rawToken)}`;
      try {
        await emailService.sendPasswordReset(user.email, resetUrl);
      } catch (error) {
        await PasswordResetToken.deleteOne({ tokenHash: hashToken(rawToken) });
        console.error('Không gửi được email đặt lại mật khẩu:', error.message);
      }
    }
    return res.json({ message: genericMessage });
  } catch (error) {
    console.error('Yêu cầu đặt lại mật khẩu thất bại:', error.message);
    return res.json({ message: genericMessage });
  }
};

exports.resetPassword = async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ message: 'Mật khẩu cần từ 10 đến 128 ký tự.' });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });

  try {
    const salt = crypto.randomBytes(16);
    const passwordHash = await scrypt(password, salt, 64);
    const reset = await PasswordResetToken.findOneAndDelete({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    if (!reset) return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    const user = await User.findById(reset.userId);
    if (!user) return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    user.passwordSalt = salt.toString('hex');
    user.passwordHash = passwordHash.toString('hex');
    await user.save();
    await Promise.all([
      AuthSession.deleteMany({ userId: user._id }),
      PasswordResetToken.deleteMany({ userId: user._id })
    ]);
    return res.json({ message: 'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.' });
  } catch (error) {
    console.error('Đặt lại mật khẩu thất bại:', error.message);
    return res.status(500).json({ message: 'Không thể đặt lại mật khẩu lúc này.' });
  }
};

exports.me = async (req, res) => {
  const auth = await getSession(req);
  if (!auth) return res.status(401).json({ message: 'Chưa đăng nhập.' });
  res.json({ username: auth.user.username, fullName: auth.user.fullName, email: auth.user.email, createdAt: auth.user.createdAt });
};

exports.updateProfile = async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (fullName.length < 2 || fullName.length > 80) return res.status(400).json({ message: 'Họ tên cần từ 2 đến 80 ký tự.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: 'Địa chỉ email không hợp lệ.' });
  try {
    const user = await User.findByIdAndUpdate(req.authUser._id, { fullName, email }, { new: true, runValidators: true }).select('username fullName email createdAt');
    res.json(user);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Email này đã được tài khoản khác sử dụng.' });
    res.status(500).json({ message: 'Không thể cập nhật thông tin lúc này.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.authUser._id);
    const current = String(req.body.currentPassword || '');
    const expected = Buffer.from(user.passwordHash, 'hex');
    const actual = await scrypt(current, Buffer.from(user.passwordSalt, 'hex'), expected.length);
    if (!crypto.timingSafeEqual(expected, actual)) return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng.' });
    const password = String(req.body.newPassword || '');
    if (password.length < 10 || password.length > 128) return res.status(400).json({ message: 'Mật khẩu mới cần từ 10 đến 128 ký tự.' });
    if (password !== String(req.body.confirmPassword || '')) return res.status(400).json({ message: 'Mật khẩu mới xác nhận không khớp.' });
    const salt = crypto.randomBytes(16);
    const passwordHash = await scrypt(password, salt, 64);
    user.passwordSalt = salt.toString('hex');
    user.passwordHash = passwordHash.toString('hex');
    await user.save();
    await AuthSession.deleteMany({ userId: user._id });
    await createSession(user, res);
    res.json({ message: 'Đã đổi mật khẩu.' });
  } catch (error) {
    console.error('Đổi mật khẩu thất bại:', error);
    res.status(500).json({ message: 'Không thể đổi mật khẩu lúc này.' });
  }
};

exports.logout = async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) await AuthSession.deleteOne({ tokenHash: hashToken(token) });
  res.clearCookie(COOKIE, cookieOptions(0));
  res.status(204).end();
};

exports.requireAuth = async (req, res, next) => {
  try {
    const auth = await getSession(req);
    if (!auth) return res.status(401).json({ message: 'Vui lòng đăng nhập.' });
    req.authUser = auth.user;
    next();
  } catch (error) { next(error); }
};

exports.authenticateSocket = async (socket, next) => {
  try {
    const cookie = socket.request.headers.cookie || '';
    const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token) return next(new Error('unauthorized'));
    const session = await AuthSession.findOne({ tokenHash: hashToken(decodeURIComponent(token)), expiresAt: { $gt: new Date() } });
    if (!session) return next(new Error('unauthorized'));
    next();
  } catch (error) { next(error); }
};
