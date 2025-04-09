import prisma from '../config/prismaClient.js';

/**
 * @desc Check if the user has permission as owner or admin to perform an action on an organization.
 * @param {Object} user - The authenticated user object (must contain id and role).
 * @param {string} organizationId - ID of the organization.
 * @param {string} [action] - Action being attempted (e.g., 'create', 'update', 'delete', 'view').
 * @returns {Promise<{ success: boolean, message?: string, isOwner?: boolean, isAdmin?: boolean }>}
 */
export const checkOwnerAdminPermission = async (
  user,
  organizationId,
  action = '',
) => {
  try {
    if (!user?.id) {
      return {
        success: false,
        message: 'User ID is required to check permissions.',
      };
    }

    // Fetch ownership and user role info
    const [isOwnerRecord, userRecord] = await Promise.all([
      prisma.organizationOwner.findFirst({
        where: { userId: user.id, organizationId },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          role: true,
          organizationId: true,
        },
      }),
    ]);

    const isOwner = Boolean(isOwnerRecord);
    const isAdmin =
      userRecord?.role === 'ADMIN' &&
      userRecord?.organizationId === organizationId;

    const hasAccess = isOwner || isAdmin;

    if (!hasAccess) {
      const actionText = action
        ? `to ${action} this resource`
        : 'to perform this operation';
      return {
        success: false,
        message: `You do not have permission ${actionText}. Only owners and administrators can perform this action.`,
      };
    }

    return {
      success: true,
      isOwner,
      isAdmin,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Internal error while checking permissions: ' + error.message,
    };
  }
};

/**
 * @desc Get all active departments (paginated) for the specified organization
 * @route GET /api/organizations/:organizationId/departments
 * @access Private (Admin/Owner only)
 */
export const getAllDepartments = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { id, role } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Check permission (Owner/Admin only)
    const permission = await checkOwnerAdminPermission(
      { id: id, role },
      organizationId,
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
 * @desc Get departments managed by current user in specified organization
 * @route GET /api/organizations/:organizationId/departments/managed
 * @access Private
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
 * @desc Create a new department
 * @route POST /api/organizations/:organizationId/departments/create
 * @access Private (Owner/Admin only)
 */
export const createDepartment = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { name, description } = req.body;
    const { id: userId, role } = req.user;
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }
    // Validate request body
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name and description are required',
      });
    }
    // Check permissions (Owner/Admin only)
    const permission = await checkOwnerAdminPermission(
      { id: userId, role },
      organizationId,
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
        managerId: userId,
      },
      include: {
        organization: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
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
 * @desc Get department by ID with related data (users, teams)
 * @route GET /api/organizations/:organizationId/departments/:id
 * @access Private (Owner/Admin only)
 */
export const getDepartmentById = async (req, res, next) => {
  try {
    const { organizationId, id } = req.params;
    const { id: userId, role } = req.user;

    // Verify organization exists
    const organization = await prisma.organization.findFirst({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const department = await prisma.department.findFirst({
      where: {
        id,
        organizationId,
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
    const isManager = department.manager.id === userId;

    if (!isManager) {
      const permission = await checkOwnerAdminPermission(
        { id: userId, role },
        organizationId,
        'view',
      );

      if (!permission.success) {
        return res.status(403).json(permission);
      }
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
 * @desc Update department details
 * @route PUT /api/organizations/:organizationId/departments/:id
 * @access Private (Owner/Admin only)
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { organizationId, id } = req.params;
    const { name, description, managerId } = req.body;
    const { id: userId, role } = req.user;
    // Validate request body
    if (!name && !description && !managerId) {
      return res.status(400).json({
        success: false,
        message:
          'At least one field (name, description, managerId) is required to update the department',
      });
    }

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

    // Check if department exists
    const department = await prisma.department.findFirst({
      where: {
        id,
        organizationId,
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
    const permission = await checkOwnerAdminPermission(
      { id: userId, role },
      organizationId,
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
          NOT: { id },
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
    if (managerId && managerId !== department.managerId) {
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
    }

    // Update department
    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        name: name !== undefined ? name : department.name,
        description:
          description !== undefined ? description : department.description,
        managerId: managerId !== undefined ? managerId : department.managerId,
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
 * @desc Soft delete a department by setting its `deletedAt` field to the current timestamp.
 * @route DELETE /api/organizations/:organizationId/departments/:id
 * @access Private (Owner/Admin only)
 */
export const softDeleteDepartment = async (req, res, next) => {
  try {
    const { organizationId, id } = req.params;
    const { id: userId, role } = req.user;

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

    // Check if department exists
    const department = await prisma.department.findFirst({
      where: {
        id,
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

    if (department.deletedAt) {
      return res.status(400).json({
        success: false,
        message: 'Department is already deleted',
      });
    }

    // Owner/Admin permission check
    const permission = await checkOwnerAdminPermission(
      { id: userId, role },
      organizationId,
      'delete',
    );

    if (!permission.success) {
      return res.status(403).json(permission);
    }

    // Soft delete department and update users
    await prisma.$transaction(async (prismaClient) => {
      // Soft delete the department
      await prismaClient.department.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
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
 * @desc Restore a soft-deleted department by setting its `deletedAt` field to `null`.
 * @route PATCH /api/organizations/:organizationId/departments/:id/restore
 * @access Private (Owner/Admin only)
 */
export const restoreDepartment = async (req, res, next) => {
  try {
    const { organizationId, id } = req.params;
    const { id: userId, role } = req.user;

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

    // Check if department exists
    const department = await prisma.department.findFirst({
      where: {
        id,
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
    const permission = await checkOwnerAdminPermission(
      { id: userId, role },
      organizationId,
      'restore',
    );

    if (!permission.success) {
      return res.status(403).json(permission);
    }

    // Restore department
    await prisma.department.update({
      where: { id },
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
