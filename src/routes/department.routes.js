import express from 'express';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  softDeleteDepartment,
  updateDepartment,
} from '../controllers/department.controller.js';
import { verifyManagerPermission } from '../middlewares/verifyManagerPermission.middleware.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  validateCreateDepartment,
  validateUpdateDepartment,
} from '../validations/department.validation.js';
import { verifyOwnerOrAdmin } from '../middlewares/verifyOwnerOrAdmin.middleware.js';

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

router.put(
  '/api/department/:id',
  verifyAccessToken,
  verifyManagerPermission,
  validateUpdateDepartment,
  updateDepartment,
);

router.delete(
  '/api/department/:id',
  verifyAccessToken,
  verifyOwnerOrAdmin,
  softDeleteDepartment,
);
export default router;
