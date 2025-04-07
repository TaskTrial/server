import express from 'express';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
} from '../controllers/department.controller.js';
import { verifyManagerPermission } from '../middlewares/verifyManagerPermission.middleware.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { validateCreateDepartment } from '../validations/department.validation.js';

const router = express.Router();

// Admin, OWNER, or MANAGER can access these
router.get(
  '/api/department/all',
  verifyAccessToken,
  verifyManagerPermission,
  getAllDepartments,
);

router.post(
  '/api/department/create',
  verifyAccessToken,
  verifyManagerPermission,
  validateCreateDepartment,
  createDepartment,
);

router.get(
  '/api/department/:id',
  verifyAccessToken,
  verifyManagerPermission,
  getDepartmentById,
);

export default router;
