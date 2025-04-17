import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  createTask,
  updateTask,
  updateTaskPriority,
} from '../controllers/task.controller.js';

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

router.patch(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/priority',
  verifyAccessToken,
  updateTaskPriority,
);

export default router;
