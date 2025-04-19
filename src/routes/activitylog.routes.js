import { Router } from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  getActivityFeed,
  getActivityLogById,
  getAllActivityLogs,
} from '../controllers/activitylog.controller.js';

const router = Router();

router.get(
  '/api/organization/:organizationId/activity-logs',
  verifyAccessToken,
  getAllActivityLogs,
);

router.get(
  '/api/organization/:organizationId/activity-logs/:logId',
  verifyAccessToken,
  getActivityLogById,
);

router.get(
  '/api/organization/:organizationId/activity-feed',
  verifyAccessToken,
  getActivityFeed,
);

export default router;
