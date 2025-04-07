import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  addTeamMember,
  createTeam,
  updateTeam,
} from '../controllers/team.controller.js';

const router = Router();

router.post(
  '/api/organization/:organizationId/department/:departmentId/team',
  verifyAccessToken,
  createTeam,
);

router.post(
  '/api/organization/:organizationId/department/:departmentId/team/:teamId/addMember',
  verifyAccessToken,
  addTeamMember,
);

router.put(
  '/api/organization/:organizationId/department/:departmentId/team/:teamId',
  verifyAccessToken,
  updateTeam,
);

export default router;
