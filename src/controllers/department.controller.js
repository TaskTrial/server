import prisma from '../config/prismaClient.js';
import {
  createDepartmentValidation,
  updateDepartmentValidation,
} from '../validations/department.validation.js';

/**
 * Helper function to check if organization exists and is not deleted
 * @param {string} organizationId - The organization ID to check
 * @returns {Promise<Object>} - Contains success flag, error message, and organization data
 */
const checkOrganization = async (organizationId) => {
  const org = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      deletedAt: null,
    },
    include: {
      owners: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!org) {
    return {
      success: false,
      message: 'Organization not found',
    };
  }

  return {
    success: true,
    organization: org,
  };
};

/**
 * Helper function to check if team exists and is not deleted
 * @param {string} teamId - The team ID to check
 * @param {string} organizationId - The organization ID the team belongs to
 * @returns {Promise<Object>} - Contains success flag, error message, and team data
 */
const checkDepartmentPermissions = (user, organization, action) => {
  const isAdmin = user.role === 'ADMIN';
  const isOwner = organization.owners.some((owner) => owner.userId === user.id);

  if (!isAdmin && !isOwner) {
    return {
      success: false,
      message: `You do not have permission to ${action} this team`,
    };
  }

  return {
    success: true,
    isAdmin,
    isOwner,
  };
};

/**
 * @desc   Get all active departments (paginated) for the specified organization
 * @route  /api/organizations/:organizationId/departments
 * @method GET
 * @access private (Admin/Owner only)
 */
export const getAllDepartments = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const organization = orgResult.organization;

    // Check permission (Owner/Admin only)
    const permission = await checkDepartmentPermissions(
      req.user,
      organization,
      'view',
    );

    if (!permission.success) {
      return res.status(403).json(permission);
    }

    const [totalDepartments, departments] = await Promise.all([
      prisma.department.count({ where: { organizationId, deletedAt: null } }),
      prisma.department.findMany({
        where: { organizationId, deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          organization: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Departments retrieved successfully',
      data: {
        departments,
        pagination: {
          page,
          limit,
          totalItems: totalDepartments,
          totalPages: Math.ceil(totalDepartments / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get department by ID with related data (users, teams)
 * @route  /api/organizations/:organizationId/departments/:id
 * @method GET
 * @access private (Owner/Admin only)
 */
export const getDepartmentById = async (req, res, next) => {
  try {
    const { organizationId, departmentId } = req.params;

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const organization = orgResult.organization;

    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        organizationId,
        deletedAt: null,
      },
      include: {
        organization: { select: { id: true, name: true } },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
          },
        },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
          },
        },
        teams: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check permission - only Owner/Admin or if user is the department manager
    const isManager = department.managerId === req.user.id;
    const permission = await checkDepartmentPermissions(
      req.user,
      organization,
      'view',
    );

    if (!permission.success && !isManager) {
      return res.status(403).json(permission);
    }

    return res.status(200).json({
      success: true,
      message: 'Department retrieved successfully',
      data: department,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc   Get departments managed by current user in specified organization
 * @route  /api/organizations/:organizationId/departments/managed
 * @method GET
 * @access private
 */
export const getCreatedDepartments = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { organizationId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Find departments managed by this user
    const whereClause = {
      deletedAt: null,
      organizationId,
      managerId: userId,
    };

    const [totalDepartments, departments] = await Promise.all([
      prisma.department.count({ where: whereClause }),
      prisma.department.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          organization: { select: { id: true, name: true } },
          _count: {
            select: {
              users: true,
              teams: true,
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Managed departments retrieved successfully',
      data: {
        departments,
        pagination: {
          page,
          limit,
          totalItems: totalDepartments,
          totalPages: Math.ceil(totalDepartments / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc   Create a new department
 * @route  /api/organizations/:organizationId/departments/create
 * @method POST
 * @access private (Owner/Admin only)
 */
export const createDepartment = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { name, description } = req.body;

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const organization = orgResult.organization;

    // Validate request body
    const { error } = createDepartmentValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Check permissions (Owner/Admin only)
    const permission = await checkDepartmentPermissions(
      req.user,
      organization,
      'create',
    );

    if (!permission.success) {
      return res.status(403).json(permission);
    }

    // Check for duplicate department name in organization
    const existingDept = await prisma.department.findFirst({
      where: {
        name,
        organizationId,
        deletedAt: null,
      },
    });

    if (existingDept) {
      return res.status(409).json({
        success: false,
        message: 'Department name already exists in this organization',
      });
    }

    // Create department
    const newDepartment = await prisma.department.create({
      data: {
        name,
        description,
        organizationId,
        managerId: req.user.id,
      },
      include: {
        organization: { select: { id: true, name: true } },
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: newDepartment,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc   Update department details
 * @route  /api/organizations/:organizationId/departments/:id
 * @method PUT
 * @access private (Owner/Admin only)
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { organizationId, departmentId } = req.params;
    const { name, description } = req.body;

    // Validate request body
    const { error } = updateDepartmentValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Verify organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const organization = orgResult.organization;

    // Check if department exists
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        managerId: true,
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Owner/Admin permission check
    const permission = await checkDepartmentPermissions(
      req.user,
      organization,
      'update',
    );

    if (!permission.success) {
      return res.status(403).json(permission);
    }

    // Check for duplicate name if changing
    if (name && name !== department.name) {
      const existingDept = await prisma.department.findFirst({
        where: {
          name,
          organizationId,
          NOT: { id: departmentId },
          deletedAt: null,
        },
      });

      if (existingDept) {
        return res.status(409).json({
          success: false,
          message: 'Department name already exists in this organization',
        });
      }
    }

    // If changing manager, verify new manager exists in organization
    /**
    *  if (managerId && managerId !== department.managerId) {
      const manager = await prisma.user.findFirst({
        where: {
          id: managerId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!manager) {
        return res.status(404).json({
          success: false,
          message: 'New manager not found in this organization',
        });
      }
    }*/

    // Update department
    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId, deletedAt: null },
      data: {
        name,
        description,
      },
      include: {
        organization: { select: { id: true, name: true } },
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc   Soft delete a department by setting its `deletedAt` field to the current timestamp.
 * @route  /api/organizations/:organizationId/departments/:id
 * @method DELETE
 * @access private (Owner/Admin only)
 */
export const softDeleteDepartment = async (req, res, next) => {
  try {
    const { organizationId, departmentId } = req.params;

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const organization = orgResult.organization;

    // Check if department exists
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true, organizationId: true, deletedAt: true },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    if (department.deletedAt) {
      return res.status(400).json({
        success: false,
        message: 'Department is already deleted',
      });
    }

    // Owner/Admin permission check
    const permission = await checkDepartmentPermissions(
      req.user,
      organization,
      'delete',
    );

    if (!permission.success) {
      return res.status(403).json(permission);
    }

    // Soft delete the department
    await prisma.department.update({
      where: { id: departmentId },
      data: { deletedAt: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: 'Department deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc   Restore a soft-deleted department by setting its `deletedAt` field to `null`.
 * @route  /api/organizations/:organizationId/departments/:id/restore
 * @method PATCH
 * @access private (Owner/Admin only)
 */
export const restoreDepartment = async (req, res, next) => {
  try {
    const { organizationId, departmentId } = req.params;

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const organization = orgResult.organization;

    // Check if department exists
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        organizationId,
      },
      select: { id: true, organizationId: true, deletedAt: true },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    if (!department.deletedAt) {
      return res.status(400).json({
        success: false,
        message: 'Department is not deleted',
      });
    }

    // Owner/Admin permission check
    const permission = await checkDepartmentPermissions(
      req.user,
      organization,
      'restore',
    );

    if (!permission.success) {
      return res.status(403).json(permission);
    }

    // Restore department
    await prisma.department.update({
      where: { id: departmentId },
      data: { deletedAt: null },
    });

    return res.status(200).json({
      success: true,
      message: 'Department restored successfully',
    });
  } catch (error) {
    return next(error);
  }
};
