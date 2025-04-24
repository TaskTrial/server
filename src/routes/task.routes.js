import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  createTask,
  deleteTask,
  getAllTasks,
  getSpecificTask,
  getTasksInSpecificOrg,
  restoreTask,
  updateTask,
  updateTaskPriority,
  updateTaskStatus,
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

router.patch(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/status',
  verifyAccessToken,
  updateTaskStatus,
);

router.get(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/all',
  verifyAccessToken,
  getAllTasks,
);

router.get(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId',
  verifyAccessToken,
  getSpecificTask,
);

router.delete(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/delete',
  verifyAccessToken,
  deleteTask,
);

router.patch(
  '/api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/restore',
  verifyAccessToken,
  restoreTask,
);

router.get(
  '/api/organization/:organizationId/tasks',
  verifyAccessToken,
  getTasksInSpecificOrg,
);

export default router;
