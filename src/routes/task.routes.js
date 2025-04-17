import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { createTask } from '../controllers/task.controller.js';

const router = Router();

router.post(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/create',
  verifyAccessToken,
  createTask,
);

export default router;
