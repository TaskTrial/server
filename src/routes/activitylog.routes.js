import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { getAllActivityLogs } from '../controllers/activitylog.controller.js';

const router = Router();

router.get(
  '/api/organization/:organizationId/activity-logs',
  verifyAccessToken,
  getAllActivityLogs,
);

export default router;
