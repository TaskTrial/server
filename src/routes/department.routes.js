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

// Get department by ID
router.get(
  '/api/organizations/:organizationId/departments/:id',
  verifyAccessToken,
  getDepartmentById,
);

// Update department - Admin/Owner only
router.put(
  '/api/organizations/:organizationId/departments/:id',
  verifyAccessToken,
  updateDepartment,
);

// Soft delete department - Admin/Owner only
router.delete(
  '/api/organizations/:organizationId/departments/:id',
  verifyAccessToken,
  softDeleteDepartment,
);

// Restore department - Admin/Owner only
router.patch(
  '/api/organizations/:organizationId/departments/:id/restore',
  verifyAccessToken,
  restoreDepartment,
);

export default router;
