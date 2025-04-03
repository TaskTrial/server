import { Router } from 'express';
import { creatOrganization } from '../controllers/organization.controller';
import { verifyAccessToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/api/organization', verifyAccessToken, creatOrganization);

export default router;
