import { Router } from 'express';
import {
  createSprint,
  deleteSprint,
  getAllSprints,
  getSpecificSprint,
  updateSprint,
  updateSprintStatus,
} from '../controllers/sprint.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { apiLimiter } from '../utils/apiLimiter.utils.js';

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
  apiLimiter,
  verifyAccessToken,
  getAllSprints,
);

router.get(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/sprint/:sprintId',
  apiLimiter,
  verifyAccessToken,
  getSpecificSprint,
);

router.delete(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/sprint/:sprintId',
  verifyAccessToken,
  deleteSprint,
);
export default router;
