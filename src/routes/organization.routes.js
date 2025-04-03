import { Router } from 'express';
import { creatOrganization } from '../controllers/organization.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/api/organization', verifyAccessToken, creatOrganization);

export default router;
