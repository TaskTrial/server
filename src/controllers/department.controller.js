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
 * @desc Get all active departments (paginated) for the user's organization
 * @route GET /api/departments
 * @access Private (Admin/Owner only)
 */
export const getAllDepartments = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Get user's organization ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return res.status(400).json({
        success: false,
        message: 'User is not associated with any organization',
      });
    }

    // Check permissions - only Admin or Owner
    const permission = await checkOwnerAdminPermission(
      { id: userId, role },
      user.organizationId,
      'view',
    );

    if (!permission.success) {
      return res.status(403).json(permission);
    }

    // Query filters - only show departments from user's organization
    const whereClause = {
      deletedAt: null,
      organizationId: user.organizationId,
    };

    // Count and fetch departments
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
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return res.status(200).json({
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
    return next(error);
  }
};

/**
 * @desc Create a new department
 * @route POST /api/departments/organization/:organizationId/manager/:managerId
 * @access Private (Owner/Admin only)
 */
export const createDepartment = async (req, res, next) => {
  try {
    const { organizationId, managerId } = req.params;
    const { name, description } = req.body;
    const { userId, role } = req.user;

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

    // Verify manager exists in organization
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
        message: 'Manager not found in this organization',
      });
    }

    // Use transaction to ensure atomicity
    const newDepartment = await prisma.$transaction(async (prismaClient) => {
      // Create department
      const department = await prismaClient.department.create({
        data: {
          name,
          description,
          organizationId,
          managerId,
        },
        include: {
          organization: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Assign department to manager
      await prismaClient.user.update({
        where: { id: managerId },
        data: { departmentId: department.id },
      });

      return department;
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
 * @desc Get department by ID
 * @route GET /api/departments/:id
 * @access Private (Owner/Admin only)
 */
export const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, ownerId: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        users: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        teams: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check permission - only Owner/Admin
    const permission = await checkOwnerAdminPermission(
      { id: userId, role },
      department.organization.id,
      'view',
    );

    if (!permission.success) {
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
 * @desc Update department details
 * @route PUT /api/departments/:id
 * @access Private (Owner/Admin only)
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const { userId, role } = req.user;

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
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
      department.organizationId,
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
          organizationId: department.organizationId,
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

    // Update department
    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        name: name || department.name,
        description:
          description !== undefined ? description : department.description,
      },
      include: {
        organization: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
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
 * @route DELETE /api/departments/:id
 * @access Private (Owner/Admin only)
 */
export const softDeleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
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
      department.organizationId,
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

      // Update users in department to have no department
      await prismaClient.user.updateMany({
        where: { departmentId: id },
        data: { departmentId: null },
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
 * @route PATCH /api/departments/:id/restore
 * @access Private (Owner/Admin only)
 */
export const restoreDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id },
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
      department.organizationId,
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
