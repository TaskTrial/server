import { Router } from 'express';
import {
  createSprint,
  getAllSprints,
  updateSprint,
  updateSprintStatus,
} from '../controllers/sprint.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/sprint/create',
  verifyAccessToken,
  createSprint,
);
router.put(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/sprint/:sprintId',
  verifyAccessToken,
  updateSprint,
);
router.patch(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/sprint/:sprintId/status',
  verifyAccessToken,
  updateSprintStatus,
);

router.get(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/sprints',
  verifyAccessToken,
  getAllSprints,
);

export default router;
