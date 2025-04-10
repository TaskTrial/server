import { Router } from 'express';
import passport from 'passport';
import {
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  signin,
  signup,
  verifyEmail,
  googleOAuthCallback,
  googleOAuthLogin,
  logout,
  resendOTP,
} from '../controllers/auth.controller.js';
import { apiLimiter } from '../utils/apiLimiter.utils.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/api/auth/signup', apiLimiter, signup);
router.post('/api/auth/resendOTP/', apiLimiter, resendOTP);
router.post('/api/auth/verifyEmail', apiLimiter, verifyEmail);
router.post('/api/auth/signin', apiLimiter, signin);
router.post('/api/auth/forgotPassword', apiLimiter, forgotPassword);
router.post('/api/auth/resetPassword', apiLimiter, resetPassword);
router.post('/api/auth/refreshAccessToken', apiLimiter, refreshAccessToken);

// Google OAuth Routes
// Initiate Google OAuth authentication
router.get(
  '/api/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'openid'],
    prompt: 'select_account',
  }),
);

// Google OAuth callback
router.get(
  '/api/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: false,
  }),
  googleOAuthCallback,
);

router.post('/auth/google', googleOAuthLogin);

// Logout
router.post('/api/auth/logout', verifyAccessToken, logout);

export default router;
