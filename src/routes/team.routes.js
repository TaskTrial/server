import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  deleteTeamAvatar,
  getAllTeams,
  getSpecificTeam,
  removeTeamMember,
  updateTeam,
  uploadTeamAvatar,
} from '../controllers/team.controller.js';
import upload from '../middlewares/upload.middleware.js';

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

router.post(
  '/api/organization/:organizationId/department/:departmentId/team/:teamId/avatar/upload',
  verifyAccessToken,
  upload.single('image'),
  uploadTeamAvatar,
);

router.delete(
  '/api/organization/:organizationId/department/:departmentId/team/:teamId/avatar/delete',
  verifyAccessToken,
  deleteTeamAvatar,
);

router.delete(
  '/api/organization/:organizationId/department/:departmentId/team/:teamId',
  verifyAccessToken,
  deleteTeam,
);

router.delete(
  '/api/organization/:organizationId/department/:departmentId/team/:teamId/members/:memberId',
  verifyAccessToken,
  removeTeamMember,
);

router.get(
  '/api/organization/:organizationId/department/:departmentId/teams/all',
  verifyAccessToken,
  getAllTeams,
);

router.get(
  '/api/organization/:organizationId/department/:departmentId/teams/:teamId',
  verifyAccessToken,
  getSpecificTeam,
);

export default router;
