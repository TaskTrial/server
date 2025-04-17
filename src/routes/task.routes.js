import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { createTask, updateTask } from '../controllers/task.controller.js';

const router = Router();

router.post(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/create',
  verifyAccessToken,
  createTask,
);

router.put(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId',
  verifyAccessToken,
  updateTask,
);

export default router;
