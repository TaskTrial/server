import { Router } from 'express';
import { signup } from '../controllers/auth.controller';

const router = Router();

router.post('/api/auth/signup', signup);

export default router;
