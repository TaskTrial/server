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
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/api/auth/signup', signup);
router.post('/api/auth/verifyEmail', verifyEmail);
router.post('/api/auth/signin', signin);
router.post('/api/auth/forgotPassword', forgotPassword);
router.post('/api/auth/resetPassword', resetPassword);
router.post('/api/auth/refreshAccessToken', refreshAccessToken);

// Google OAuth Routes
// Initiate Google OAuth authentication
router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'openid'],
    prompt: 'select_account',
  }),
);

// Google OAuth callback
router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: false,
  }),
  googleOAuthCallback,
);

// Google OAuth Login/Signup Endpoint (for mobile/SPA)
router.post('/auth/google', googleOAuthLogin);

export default router;
