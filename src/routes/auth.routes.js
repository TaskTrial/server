import { Router } from 'express';
import { signup, verifyEmail } from '../controllers/auth.controller.js';

const router = Router();

router.post('/api/auth/signup', signup);
router.post('/api/auth/verifyEmail', verifyEmail);

export default router;
