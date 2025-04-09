import express from 'express';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  restoreDepartment,
  softDeleteDepartment,
  updateDepartment,
} from '../controllers/department.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import {
  validateCreateDepartment,
  validateUpdateDepartment,
} from '../validations/department.validation.js';

const router = express.Router();

// All routes below are restricted to Organization Owners and Admins only

// Get all departments (with pagination)
router.get('/api/departments', verifyAccessToken, getAllDepartments);

// Create department
router.post(
  '/api/departments/organization/:organizationId/manager/:managerId',
  verifyAccessToken,
  validateCreateDepartment,
  createDepartment,
);

// Get department by ID
router.get('/api/departments/:id', verifyAccessToken, getDepartmentById);

// Update department
router.put(
  '/api/departments/:id',
  verifyAccessToken,
  validateUpdateDepartment,
  updateDepartment,
);

// Soft delete department
router.delete('/api/departments/:id', verifyAccessToken, softDeleteDepartment);

// Restore department
router.patch(
  '/api/departments/:id/restore',
  verifyAccessToken,
  restoreDepartment,
);

export default router;
