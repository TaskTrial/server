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
  '/api/organization/:organizationId/team',
  verifyAccessToken,
  createTeam,
);

router.post(
  '/api/organization/:organizationId/team/:teamId/addMember',
  verifyAccessToken,
  addTeamMember,
);

router.put(
  '/api/organization/:organizationId/team/:teamId',
  verifyAccessToken,
  updateTeam,
);

router.post(
  '/api/organization/:organizationId/team/:teamId/avatar/upload',
  verifyAccessToken,
  upload.single('image'),
  uploadTeamAvatar,
);

router.delete(
  '/api/organization/:organizationId/team/:teamId/avatar/delete',
  verifyAccessToken,
  deleteTeamAvatar,
);

router.delete(
  '/api/organization/:organizationId/team/:teamId',
  verifyAccessToken,
  deleteTeam,
);

router.delete(
  '/api/organization/:organizationId/team/:teamId/members/:memberId',
  verifyAccessToken,
  removeTeamMember,
);

router.get(
  '/api/organization/:organizationId/teams/all',
  verifyAccessToken,
  getAllTeams,
);

router.get(
  '/api/organization/:organizationId/teams/:teamId',
  verifyAccessToken,
  getSpecificTeam,
);

export default router;
