// Mock auth routes for testing
import express from 'express';
import * as authController from '../../controllers/auth.controller.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Auth routes
router.post('/signup', authController.signup);
router.post('/signin', authController.signin);

// Rate limiter for verifyEmail route: max 5 requests per minute
const verifyEmailLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many requests, please try again later.',
});

router.post('/verifyEmail', verifyEmailLimiter, authController.verifyEmail);
router.post('/resendOTP', authController.resendOTP);
router.post('/forgotPassword', authController.forgotPassword);
router.post('/resetPassword', authController.resetPassword);
router.post('/refreshAccessToken', authController.refreshAccessToken);
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
