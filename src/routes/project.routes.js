import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { createProject } from '../controllers/project.controller.js';

const router = Router();

router.post(
  '/api/organization/:organizationId/team/:teamId/project',
  verifyAccessToken,
  createProject,
);

export default router;
