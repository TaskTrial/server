import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { createTeam } from '../controllers/team.controller.js';

const router = Router();

router.post(
  '/api/organization/:organizationId/department/:departmentId/team',
  verifyAccessToken,
  createTeam,
);

export default router;
