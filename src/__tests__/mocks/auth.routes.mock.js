// Mock auth routes for testing
import express from 'express';
import * as authController from '../../controllers/auth.controller.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Define rate limiters for sensitive routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests, please try again later.',
  },
});

const refreshTokenLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many refresh token requests, please try again later.',
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many password reset attempts, please try again later.',
  },
});

// Auth routes
router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/verifyEmail', authController.verifyEmail);
router.post('/resendOTP', authLimiter, authController.resendOTP);
router.post(
  '/forgotPassword',
  passwordResetLimiter,
  authController.forgotPassword,
);
router.post(
  '/resetPassword',
  passwordResetLimiter,
  authController.resetPassword,
);
router.post(
  '/refreshAccessToken',
  refreshTokenLimiter,
  authController.refreshAccessToken,
);
router.post('/logout', authController.logout);
router.post('/google', authController.googleOAuthLogin);

// Rate limiter for firebaseLogin route: max 10 requests per minute
const firebaseLoginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many requests, please try again later.',
});

router.post('/firebase', firebaseLoginLimiter, authController.firebaseLogin);

export default router;
