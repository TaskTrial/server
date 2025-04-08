import express from 'express';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  restoreDepartment,
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
  '/api/departments/all',
  verifyAccessToken,
  verifyManagerPermission,
  getAllDepartments,
);

router.post(
  '/api/departments/create',
  verifyAccessToken,
  verifyManagerPermission,
  validateCreateDepartment,
  createDepartment,
);

router.get(
  '/api/departments/:id',
  verifyAccessToken,
  verifyManagerPermission,
  getDepartmentById,
);

router.put(
  '/api/departments/:id',
  verifyAccessToken,
  verifyManagerPermission,
  validateUpdateDepartment,
  updateDepartment,
);

router.delete(
  '/api/departments/:id',
  verifyAccessToken,
  verifyOwnerOrAdmin,
  softDeleteDepartment,
);

router.patch(
  '/api/departments/:id/restore',
  verifyAccessToken,
  verifyOwnerOrAdmin,
  restoreDepartment,
);
export default router;
