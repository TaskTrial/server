import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  createProject,
  updateProject,
} from '../controllers/project.controller.js';

const router = Router();

router.post(
  '/api/organization/:organizationId/team/:teamId/project',
  verifyAccessToken,
  createProject,
);

router.put(
  '/api/organization/:organizationId/team/:teamId/project/:projectId',
  verifyAccessToken,
  updateProject,
);

export default router;
