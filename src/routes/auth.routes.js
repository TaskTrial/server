import { Router } from 'express';
import {
  forgotPassword,
  resetPassword,
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

export default router;
