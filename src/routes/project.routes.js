import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  createProject,
  updateProject,
  updateProjectStatus,
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

router.patch(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/status',
  verifyAccessToken,
  updateProjectStatus,
);

export default router;
