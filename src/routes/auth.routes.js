import { Router } from 'express';
import {
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  signin,
  signup,
  verifyEmail,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/api/auth/signup', signup);
router.post('/api/auth/verifyEmail', verifyEmail);
router.post('/api/auth/signin', signin);
router.post('/api/auth/forgotPassword', forgotPassword);
router.post('/api/auth/resetPassword', resetPassword);
router.post('/api/auth/refreshAccessToken', refreshAccessToken);

export default router;
