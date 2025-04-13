import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  addProjectMember,
  createProject,
  deleteProject,
  getAllProjects,
  getSpecificProject,
  removeProjectMember,
  restoreProject,
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
  '/api/organization/:organizationId/team/:teamId/project/:projectId/delete',
  verifyAccessToken,
  deleteProject,
);

router.patch(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/restore',
  verifyAccessToken,
  restoreProject,
);

router.post(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/addMember',
  verifyAccessToken,
  addProjectMember,
);

router.delete(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/removeMember',
  verifyAccessToken,
  removeProjectMember,
);

router.get(
  '/api/organization/:organizationId/team/:teamId/project/all',
  verifyAccessToken,
  getAllProjects,
);

router.get(
  '/api/organization/:organizationId/team/:teamId/project/:projectId',
  verifyAccessToken,
  getSpecificProject,
);

export default router;
