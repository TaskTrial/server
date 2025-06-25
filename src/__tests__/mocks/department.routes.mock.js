import express from 'express';
import { mockAuthMiddleware } from './middleware.mock.js';

const router = express.Router({ mergeParams: true });

// Mock department controller functions
export const mockDepartmentController = {
  getAllDepartments: (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    return res.status(200).json({
      success: true,
      message: 'Departments retrieved successfully',
      data: {
        departments: [
          {
            id: 'mock-dept-id-1',
            name: 'Engineering',
            description: 'Software engineering department',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            organization: {
              id: req.params.organizationId,
              name: 'Test Organization',
            },
            manager: {
              id: 'mock-user-id',
              firstName: 'Test',
              lastName: 'Manager',
            },
          },
          {
            id: 'mock-dept-id-2',
            name: 'Marketing',
            description: 'Marketing department',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            organization: {
              id: req.params.organizationId,
              name: 'Test Organization',
            },
            manager: {
              id: 'mock-user-id',
              firstName: 'Test',
              lastName: 'Manager',
            },
          },
        ],
        pagination: {
          page,
          limit,
          totalItems: 2,
          totalPages: 1,
        },
      },
    });
  },

  getDepartmentById: (req, res) => {
    const { departmentId } = req.params;

    if (
      departmentId !== 'mock-dept-id-1' &&
      departmentId !== 'mock-dept-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Department retrieved successfully',
      data: {
        id: departmentId,
        name: departmentId === 'mock-dept-id-1' ? 'Engineering' : 'Marketing',
        description:
          departmentId === 'mock-dept-id-1'
            ? 'Software engineering department'
            : 'Marketing department',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        organization: {
          id: req.params.organizationId,
          name: 'Test Organization',
        },
        manager: { id: 'mock-user-id', firstName: 'Test', lastName: 'Manager' },
        users: [
          {
            id: 'mock-user-id-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            jobTitle: 'Developer',
          },
          {
            id: 'mock-user-id-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            jobTitle: 'Designer',
          },
        ],
        teams: [
          {
            id: 'mock-team-id-1',
            name: 'Frontend',
            description: 'Frontend development team',
          },
          {
            id: 'mock-team-id-2',
            name: 'Backend',
            description: 'Backend development team',
          },
        ],
      },
    });
  },

  getCreatedDepartments: (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    return res.status(200).json({
      success: true,
      message: 'Managed departments retrieved successfully',
      data: {
        departments: [
          {
            id: 'mock-dept-id-1',
            name: 'Engineering',
            description: 'Software engineering department',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            organization: {
              id: req.params.organizationId,
              name: 'Test Organization',
            },
            _count: {
              users: 5,
              teams: 2,
            },
          },
        ],
        pagination: {
          page,
          limit,
          totalItems: 1,
          totalPages: 1,
        },
      },
    });
  },

  createDepartment: (req, res) => {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    if (name === 'Existing Department') {
      return res.status(409).json({
        success: false,
        message: 'Department name already exists in this organization',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: {
        id: 'mock-new-dept-id',
        name,
        description,
        organizationId: req.params.organizationId,
        managerId: 'mock-user-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        organization: {
          id: req.params.organizationId,
          name: 'Test Organization',
        },
        manager: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'Manager',
          email: 'manager@example.com',
        },
      },
    });
  },

  updateDepartment: (req, res) => {
    const { departmentId } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    if (
      departmentId !== 'mock-dept-id-1' &&
      departmentId !== 'mock-dept-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    if (name === 'Existing Department') {
      return res.status(409).json({
        success: false,
        message: 'Department name already exists in this organization',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: {
        id: departmentId,
        name,
        description,
        organizationId: req.params.organizationId,
        managerId: 'mock-user-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        organization: {
          id: req.params.organizationId,
          name: 'Test Organization',
        },
        manager: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'Manager',
          email: 'manager@example.com',
        },
      },
    });
  },

  softDeleteDepartment: (req, res) => {
    const { departmentId } = req.params;

    if (
      departmentId !== 'mock-dept-id-1' &&
      departmentId !== 'mock-dept-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    if (
      departmentId === 'mock-dept-id-2' &&
      req.query.alreadyDeleted === 'true'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Department is already deleted',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Department deleted successfully',
    });
  },

  restoreDepartment: (req, res) => {
    const { departmentId } = req.params;

    if (
      departmentId !== 'mock-dept-id-1' &&
      departmentId !== 'mock-dept-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    if (departmentId === 'mock-dept-id-1' && req.query.notDeleted === 'true') {
      return res.status(400).json({
        success: false,
        message: 'Department is not deleted',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Department restored successfully',
    });
  },
};

// Apply mock controller to routes
router.use(mockAuthMiddleware);
router.get('/', mockDepartmentController.getAllDepartments);
router.get('/managed', mockDepartmentController.getCreatedDepartments);
router.get('/:departmentId', mockDepartmentController.getDepartmentById);
router.post('/create', mockDepartmentController.createDepartment);
router.put('/:departmentId', mockDepartmentController.updateDepartment);
router.delete('/:departmentId', mockDepartmentController.softDeleteDepartment);
router.patch(
  '/:departmentId/restore',
  mockDepartmentController.restoreDepartment,
);

export default router;
