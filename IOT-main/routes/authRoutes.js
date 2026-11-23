const express = require('express');
const auth = require('../controllers/authController');
const router = express.Router();

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.get('/me', auth.me);
router.patch('/profile', auth.requireAuth, auth.updateProfile);
router.post('/password', auth.requireAuth, auth.changePassword);
router.post('/logout', auth.logout);

module.exports = router;
