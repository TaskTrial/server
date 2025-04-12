import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  createProject,
  deleteProject,
  updateProject,
  updateProjectPriority,
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

router.patch(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/priority',
  verifyAccessToken,
  updateProjectPriority,
);

router.delete(
  '/api/organization/:organizationId/team/:teamId/project/:projectId',
  verifyAccessToken,
  deleteProject,
);

export default router;
