/* eslint-env node */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  getAllDepartments,
  getDepartmentById,
  getCreatedDepartments,
  createDepartment,
  updateDepartment,
  softDeleteDepartment,
  restoreDepartment,
} from '../../../controllers/department.controller.js';
import { mockPrisma, mockCreateActivityLog } from '../../setup.js';

/* eslint no-undef: off */

// Mock validation schemas
jest.mock('../../../validations/department.validation.js', () => ({
  createDepartmentValidation: jest.fn(),
  updateDepartmentValidation: jest.fn(),
}));

describe('Department Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getAllDepartments', () => {
    it('should get all departments successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.query = { page: '1' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const departments = [
        {
          id: 'dept-1',
          name: 'Engineering',
          description: 'Software Engineering Department',
          createdAt: new Date(),
          updatedAt: new Date(),
          organization: { id: organizationId, name: 'Test Org' },
          manager: { id: 'manager-1', firstName: 'John', lastName: 'Doe' },
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.count.mockResolvedValue(1);
      mockPrisma.department.findMany.mockResolvedValue(departments);

      await getAllDepartments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Departments retrieved successfully',
        data: {
          departments,
          pagination: {
            page: 1,
            limit: 10,
            totalItems: 1,
            totalPages: 1,
          },
        },
      });
    });

    it('should allow access if user is organization member', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.query = { page: '1' };
      req.user = { id: 'member-id', role: 'USER' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'member-id' }], // User is a member
      };

      const departments = [];

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.count.mockResolvedValue(0);
      mockPrisma.department.findMany.mockResolvedValue(departments);

      await getAllDepartments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Departments retrieved successfully',
        data: {
          departments,
          pagination: {
            page: 1,
            limit: 10,
            totalItems: 0,
            totalPages: 0,
          },
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.count.mockRejectedValue(
        new Error('Database error'),
      );

      await getAllDepartments(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await getAllDepartments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'USER' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'other-user' }],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);

      await getAllDepartments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You are not a member of this organization.',
      });
    });
  });

  describe('getDepartmentById', () => {
    it('should get department by ID successfully', async () => {
      const organizationId = 'org-id';
      const departmentId = 'dept-id';
      req.params = { organizationId, departmentId };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: departmentId,
        name: 'Engineering',
        description: 'Software Engineering Department',
        organization: { id: organizationId, name: 'Test Org' },
        manager: {
          id: 'manager-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          jobTitle: 'Engineering Manager',
        },
        users: [
          {
            id: 'user-1',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@test.com',
            jobTitle: 'Developer',
          },
        ],
        teams: [
          {
            id: 'team-1',
            name: 'Frontend Team',
            description: 'Frontend Development Team',
          },
        ],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);

      await getDepartmentById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Department retrieved successfully',
        data: department,
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await getDepartmentById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if department not found', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'invalid-id' };
      req.user = { id: 'user-id' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await getDepartmentById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Department not found',
      });
    });

    it('should allow access if user is department manager', async () => {
      const organizationId = 'org-id';
      const departmentId = 'dept-id';
      req.params = { organizationId, departmentId };
      req.user = { id: 'manager-id', role: 'USER' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'other-user' }],
      };

      const department = {
        id: departmentId,
        managerId: 'manager-id',
        name: 'Engineering',
        organization: { id: organizationId, name: 'Test Org' },
        manager: { id: 'manager-id', firstName: 'John', lastName: 'Doe' },
        users: [],
        teams: [],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);

      await getDepartmentById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Department retrieved successfully',
        data: department,
      });
    });
  });

  describe('getCreatedDepartments', () => {
    it('should get departments managed by current user successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.query = { page: '1', limit: '10' };
      req.user = { id: 'user-id' };

      const organization = { id: organizationId, users: [{ id: 'user-id' }] };

      const departments = [
        {
          id: 'dept-1',
          name: 'Engineering',
          description: 'Software Engineering Department',
          createdAt: new Date(),
          updatedAt: new Date(),
          organization: { id: organizationId, name: 'Test Org' },
          _count: { users: 5, teams: 2 },
        },
      ];

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.count.mockResolvedValue(1);
      mockPrisma.department.findMany.mockResolvedValue(departments);

      await getCreatedDepartments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Managed departments retrieved successfully',
        data: {
          departments,
          pagination: {
            page: 1,
            limit: 10,
            totalItems: 1,
            totalPages: 1,
          },
        },
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await getCreatedDepartments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });
  });

  describe('createDepartment', () => {
    it('should create department successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.body = {
        name: 'Engineering',
        description: 'Software Engineering Department',
      };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const newDepartment = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId,
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: { id: organizationId, name: 'Test Org' },
        manager: {
          id: 'user-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
        },
      };

      const { createDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      createDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(null);
      mockPrisma.department.create.mockResolvedValue(newDepartment);
      mockCreateActivityLog.mockResolvedValue({});

      await createDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Department created successfully',
        data: newDepartment,
      });
    });

    it('should return error if validation fails', async () => {
      req.params = { organizationId: 'org-id' };
      req.body = { name: '' };

      const { createDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      createDepartmentValidation.mockReturnValue({
        error: { details: [{ message: 'Name is required' }] },
      });

      await createDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Name is required',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id' };
      req.body = { name: 'Engineering' };

      const { createDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      createDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await createDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id' };
      req.body = { name: 'Engineering' };
      req.user = { id: 'user-id', role: 'USER' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'other-user' }],
      };

      const { createDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      createDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);

      await createDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to create this department',
      });
    });

    it('should return error if department name already exists', async () => {
      req.params = { organizationId: 'org-id' };
      req.body = { name: 'Engineering' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const existingDepartment = {
        id: 'existing-dept-id',
        name: 'Engineering',
      };

      const { createDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      createDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(existingDepartment);

      await createDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Department name already exists in this organization',
      });
    });

    it('should handle database errors during department creation', async () => {
      req.params = { organizationId: 'org-id' };
      req.body = { name: 'Engineering', description: 'Test department' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const { createDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      createDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(null);
      mockPrisma.department.create.mockRejectedValue(
        new Error('Database error'),
      );

      await createDepartment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle activity log creation errors gracefully', async () => {
      req.params = { organizationId: 'org-id' };
      req.body = { name: 'Engineering', description: 'Test department' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const newDepartment = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Test department',
        organizationId: 'org-id',
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: { id: 'org-id', name: 'Test Org' },
        manager: {
          id: 'user-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
        },
      };

      const { createDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      createDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(null);
      mockPrisma.department.create.mockResolvedValue(newDepartment);
      mockCreateActivityLog.mockRejectedValue(new Error('Activity log error'));

      await createDepartment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateDepartment', () => {
    it('should update department successfully', async () => {
      const organizationId = 'org-id';
      const departmentId = 'dept-id';
      req.params = { organizationId, departmentId };
      req.body = {
        name: 'Updated Engineering',
        description: 'Updated description',
      };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const existingDepartment = {
        id: departmentId,
        name: 'Engineering',
        description: 'Old description',
        organizationId,
        managerId: 'user-id',
      };

      const updatedDepartment = {
        id: departmentId,
        name: 'Updated Engineering',
        description: 'Updated description',
        organization: { id: organizationId, name: 'Test Org' },
        manager: {
          id: 'user-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
        },
      };

      const { updateDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      updateDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(existingDepartment);
      mockPrisma.department.findFirst.mockResolvedValueOnce(existingDepartment);
      mockPrisma.department.findFirst.mockResolvedValueOnce(null); // For duplicate check
      mockPrisma.department.update.mockResolvedValue(updatedDepartment);
      mockCreateActivityLog.mockResolvedValue({});

      await updateDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Department updated successfully',
        data: updatedDepartment,
      });
    });

    it('should return error if validation fails', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.body = { name: '' };

      const { updateDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      updateDepartmentValidation.mockReturnValue({
        error: { details: [{ message: 'Name is required' }] },
      });

      await updateDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Name is required',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id', departmentId: 'dept-id' };
      req.body = { name: 'Updated Engineering' };

      const { updateDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      updateDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await updateDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if department not found', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'invalid-id' };
      req.body = { name: 'Updated Engineering' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const { updateDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      updateDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await updateDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Department not found',
      });
    });

    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.body = { name: 'Updated Engineering' };
      req.user = { id: 'user-id', role: 'USER' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'other-user' }],
      };

      const existingDepartment = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Old description',
        organizationId: 'org-id',
        managerId: 'other-user',
      };

      const { updateDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      updateDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(existingDepartment);

      await updateDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to update this department',
      });
    });

    it('should return error if department name already exists', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.body = { name: 'Existing Department' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const existingDepartment = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Old description',
        organizationId: 'org-id',
        managerId: 'user-id',
      };

      const duplicateDepartment = {
        id: 'other-dept-id',
        name: 'Existing Department',
      };

      const { updateDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      updateDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(existingDepartment);
      mockPrisma.department.findFirst.mockResolvedValueOnce(existingDepartment);
      mockPrisma.department.findFirst.mockResolvedValueOnce(
        duplicateDepartment,
      ); // For duplicate check

      await updateDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Department name already exists in this organization',
      });
    });

    it('should handle database errors during department update', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.body = { name: 'Updated Engineering' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const existingDepartment = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Old description',
        organizationId: 'org-id',
        managerId: 'user-id',
      };

      const { updateDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      updateDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(existingDepartment);
      mockPrisma.department.findFirst.mockResolvedValueOnce(existingDepartment);
      mockPrisma.department.findFirst.mockResolvedValueOnce(null); // For duplicate check
      mockPrisma.department.update.mockRejectedValue(
        new Error('Database error'),
      );

      await updateDepartment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle activity log errors during department update', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.body = { name: 'Updated Engineering' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const existingDepartment = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Old description',
        organizationId: 'org-id',
        managerId: 'user-id',
      };

      const updatedDepartment = {
        id: 'dept-id',
        name: 'Updated Engineering',
        description: 'Old description',
        organization: { id: 'org-id', name: 'Test Org' },
        manager: {
          id: 'user-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
        },
      };

      const { updateDepartmentValidation } = await import(
        '../../../validations/department.validation.js'
      );
      updateDepartmentValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(existingDepartment);
      mockPrisma.department.findFirst.mockResolvedValueOnce(existingDepartment);
      mockPrisma.department.findFirst.mockResolvedValueOnce(null); // For duplicate check
      mockPrisma.department.update.mockResolvedValue(updatedDepartment);
      mockCreateActivityLog.mockRejectedValue(new Error('Activity log error'));

      await updateDepartment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('softDeleteDepartment', () => {
    it('should soft delete department successfully', async () => {
      const organizationId = 'org-id';
      const departmentId = 'dept-id';
      req.params = { organizationId, departmentId };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: departmentId,
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId,
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);
      mockPrisma.department.update.mockResolvedValue({});
      mockCreateActivityLog.mockResolvedValue({});

      await softDeleteDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Department deleted successfully',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await softDeleteDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if department not found', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'invalid-id' };
      req.user = { id: 'user-id' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await softDeleteDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Department not found',
      });
    });

    it('should return error if department is already deleted', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId: 'org-id',
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(), // Already deleted
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);

      await softDeleteDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Department is already deleted',
      });
    });

    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id', role: 'USER' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'other-user' }],
      };

      const department = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId: 'org-id',
        managerId: 'other-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);

      await softDeleteDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to delete this department',
      });
    });

    it('should handle database errors during department deletion', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId: 'org-id',
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);
      mockPrisma.department.update.mockRejectedValue(
        new Error('Database error'),
      );

      await softDeleteDepartment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle activity log errors during department deletion', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId: 'org-id',
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);
      mockPrisma.department.update.mockResolvedValue({});
      mockCreateActivityLog.mockRejectedValue(new Error('Activity log error'));

      await softDeleteDepartment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('restoreDepartment', () => {
    it('should restore department successfully', async () => {
      const organizationId = 'org-id';
      const departmentId = 'dept-id';
      req.params = { organizationId, departmentId };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: departmentId,
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId,
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(), // Currently deleted
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);
      mockPrisma.department.update.mockResolvedValue({});
      mockCreateActivityLog.mockResolvedValue({});

      await restoreDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Department restored successfully',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await restoreDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if department not found', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'invalid-id' };
      req.user = { id: 'user-id' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await restoreDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Department not found',
      });
    });

    it('should return error if department is not deleted', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId: 'org-id',
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null, // Not deleted
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);

      await restoreDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Department is not deleted',
      });
    });

    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id', role: 'USER' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'other-user' }],
      };

      const department = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId: 'org-id',
        managerId: 'other-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);

      await restoreDepartment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to restore this department',
      });
    });

    it('should handle database errors during department restoration', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId: 'org-id',
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);
      mockPrisma.department.update.mockRejectedValue(
        new Error('Database error'),
      );

      await restoreDepartment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle activity log errors during department restoration', async () => {
      req.params = { organizationId: 'org-id', departmentId: 'dept-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };

      const department = {
        id: 'dept-id',
        name: 'Engineering',
        description: 'Software Engineering Department',
        organizationId: 'org-id',
        managerId: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.department.findFirst.mockResolvedValue(department);
      mockPrisma.department.update.mockResolvedValue({});
      mockCreateActivityLog.mockRejectedValue(new Error('Activity log error'));

      await restoreDepartment(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
