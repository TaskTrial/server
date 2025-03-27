import { Router } from 'express';
import {
  forgotPassword,
  signin,
  signup,
  verifyEmail,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/api/auth/signup', signup);
router.post('/api/auth/verifyEmail', verifyEmail);
router.post('/api/auth/signin', signin);
router.post('/api/auth/forgotPassword', forgotPassword);

export default router;
