import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { addTeamMember, createTeam } from '../controllers/team.controller.js';

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

export default router;
