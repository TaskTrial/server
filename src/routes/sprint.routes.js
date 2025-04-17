import { Router } from 'express';
import { createSprint } from '../controllers/sprint.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/sprint/create',
  verifyAccessToken,
  createSprint,
);

export default router;
