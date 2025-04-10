import express from 'express';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  softDeleteDepartment,
  restoreDepartment,
  getCreatedDepartments,
} from '../controllers/department.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
const router = express.Router();

// Routes for Organization Owners and Admins only
router.get(
  '/api/organizations/:organizationId/departments/all',
  verifyAccessToken,
  getAllDepartments,
);

// Get department by ID
router.get(
  '/api/organizations/:organizationId/departments/:departmentId',
  verifyAccessToken,
  getDepartmentById,
);

// Routes accessible by Department Managers
router.get(
  '/api/organizations/:organizationId/departments/created',
  verifyAccessToken,
  getCreatedDepartments,
);

// Create department - Admin/Owner only
router.post(
  '/api/organizations/:organizationId/departments/create',
  verifyAccessToken,
  createDepartment,
);

// Update department - Admin/Owner only
router.put(
  '/api/organizations/:organizationId/departments/:departmentId',
  verifyAccessToken,
  updateDepartment,
);

// Soft delete department - Admin/Owner only
router.delete(
  '/api/organizations/:organizationId/departments/:departmentId/delete',
  verifyAccessToken,
  softDeleteDepartment,
);

// Restore department - Admin/Owner only
router.patch(
  '/api/organizations/:organizationId/departments/:departmentId/restore',
  verifyAccessToken,
  restoreDepartment,
);

export default router;
