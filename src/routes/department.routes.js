import express from 'express';
import { getAllDepartments } from '../controllers/department.controller.js';
import { verifyManagerPermission } from '../middlewares/verifyManagerPermission.middleware.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Admin, OWNER, or MANAGER can access these
router.get(
  '/api/department/all',
  verifyAccessToken,
  verifyManagerPermission,
  getAllDepartments,
);
export default router;
