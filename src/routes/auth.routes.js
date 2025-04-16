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
  forgotPasswordWithoutEmail,
  resetPasswordWithoutEmail,
  firebaseLogin,
} from '../controllers/auth.controller.js';
import { apiLimiter } from '../utils/apiLimiter.utils.js';
import { verifyFirebaseToken } from '../middlewares/firebaseAuth.middleware.js';

const router = Router();

router.post('/api/auth/signup', apiLimiter, signup);
router.post('/api/auth/resendOTP', apiLimiter, resendOTP);
router.post('/api/auth/verifyEmail', apiLimiter, verifyEmail);
router.post('/api/auth/signin', apiLimiter, signin);
router.post('/api/auth/forgotPassword', apiLimiter, forgotPassword);
router.post('/api/auth/resetPassword', apiLimiter, resetPassword);
router.post(
  '/api/auth/forgotPasswordWithoutEmail',
  apiLimiter,
  forgotPasswordWithoutEmail,
);
router.post(
  '/api/auth/resetPasswordWithoutEmail',
  apiLimiter,
  resetPasswordWithoutEmail,
);
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

router.post('/api/auth/google', googleOAuthLogin);

// Logout
router.post('/api/auth/logout', logout);

// Firebase sign-in endpoint
router.post('/api/auth/firebase', firebaseLogin);

// Protected route
router.get('/me', verifyFirebaseToken, async (req, res) => {
  if (!req.user) {
    return res.status(404).json({ message: 'User not found in database' });
  }

  res.status(200).json({ user: req.user });
});

export default router;
