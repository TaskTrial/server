import prisma from '../config/prismaClient.js';

/**
 * @desc   Get all departments
 * @route  GET /api/departments
 * @method GET
 * @access Private (Admin or Manager)
 */
export const getAllDepartments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalDepartments = await prisma.department.count({
      where: { deletedAt: null },
    });

    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(200).json({
      message: 'Departments retrieved successfully',
      currentPage: page,
      totalPages: Math.ceil(totalDepartments / limit),
      totalDepartments,
      departments,
    });
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { name, description, organizationId, managerId } = req.body;

    // Check required fields
    if (!name || !organizationId || !managerId) {
      return res
        .status(400)
        .json({ message: 'Name, organizationId, and managerId are required' });
    }

    // Ensure department name is unique within the same organization
    const existingDepartment = await prisma.department.findFirst({
      where: {
        name,
        organizationId,
        deletedAt: null,
      },
    });

    if (existingDepartment) {
      return res.status(409).json({
        message: 'Department name already exists in this organization',
      });
    }

    const Is_Owner = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        ownerId: req.managerId,
      },
    });
    if (!Is_Owner) {
      return res.status(403).json({
        message:
          'You do not have permission to create a department in this organization',
      });
    }

    // Check if manager exists, is active, and belongs to the same organization
    const manager = await prisma.user.findFirst({
      where: {
        id: managerId,
        organizationId, // this line checks the manager is in the same org
        deletedAt: null,
      },
    });

    // Check if the manager is already assigned to another department
    if (!manager) {
      return res.status(404).json({
        message: 'Manager not found or does not belong to this organization',
      });
    }

    // Create the department
    const newDepartment = await prisma.department.create({
      data: {
        name,
        description,
        organizationId,
        managerId,
      },
      include: {
        organization: { select: { id: true, name: true } },
        manager: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    // Assign "MANAGER" role to the manager
    await prisma.user.update({
      where: { id: managerId },
      data: {
        departmentId: newDepartment.id,
      },
    });

    return res.status(201).json({
      message: 'Department created successfully',
      department: newDepartment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get a specific department by ID
 * @route  GET /api/departments/:id
 * @access Private (OWNER, ADMIN, MANAGER)
 */
export const getDepartmentById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const department = await prisma.department.findFirst({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          where: { deletedAt: null }, // Only active users
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
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

    return res.status(200).json({
      success: true,
      message: 'Department retrieved successfully',
      data: {
        id: department.id,
        name: department.name,
        description: department.description,
        deletedAt: department.deletedAt,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
        manager: department.manager,
        teams: department.teams,
        users: department.users,
        organization: {
          id: department.organizationId,
          name: department.organization.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update a department
 * @route  PUT /api/department/:id
 * @access Private (Admin or Manager with department access)
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, addUsers, removeUsers } = req.body;
    const { userId, role } = req.user;

    // Check if department exists with organization and manager info
    const department = await prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        organization: true,
        manager: true,
        users: { where: { deletedAt: null } },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Permission check
    if (role === 'MANAGER') {
      if (!department.managerId || department.managerId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update departments you manage',
        });
      }
    } else if (role === 'ADMIN' || role === 'OWNER') {
      const userInOrg = await prisma.user.findFirst({
        where: {
          id: userId,
          organizationId: department.organizationId, // Fixed this line
          deletedAt: null,
        },
        select: {
          id: true,
          role: true,
          organizationId: true,
          departmentId: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      if (!userInOrg) {
        return res.status(403).json({
          success: false,
          message: 'User does not belong to this organization',
        });
      }

      if (userInOrg.role !== 'ADMIN' && userInOrg.role !== 'OWNER') {
        return res.status(403).json({
          success: false,
          message: 'You do not have the required role to perform this action',
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update departments',
      });
    }

    // If name is being changed, check for uniqueness
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

    // Prepare transaction for multiple operations
    const transaction = [];

    // Update department basic info if needed
    if (name || description !== undefined) {
      transaction.push(
        prisma.department.update({
          where: { id },
          data: {
            name: name || department.name,
            description:
              description !== undefined ? description : department.description,
          },
        }),
      );
    }

    // Handle user additions only if addUsers exists and has items
    if (addUsers?.length > 0) {
      // Verify users exist and belong to same organization
      const existingUsers = await prisma.user.findMany({
        where: {
          id: { in: addUsers },
          organizationId: department.organizationId,
          deletedAt: null,
        },
      });

      if (existingUsers.length !== addUsers.length) {
        return res.status(400).json({
          success: false,
          message: 'Some users not found or not in the same organization',
        });
      }

      transaction.push(
        prisma.user.updateMany({
          where: { id: { in: addUsers } },
          data: { departmentId: id },
        }),
      );
    }

    // Handle user removals only if removeUsers exists and has items
    if (removeUsers?.length > 0) {
      // Don't allow removing the manager
      if (removeUsers.includes(department.managerId)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove department manager this way',
        });
      }

      transaction.push(
        prisma.user.updateMany({
          where: {
            id: { in: removeUsers },
            departmentId: id,
          },
          data: { departmentId: null },
        }),
      );
    }

    // Only execute transaction if there are operations to perform
    if (transaction.length > 0) {
      await prisma.$transaction(transaction);
    } else {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
      });
    }

    // Fetch updated department with all relations
    const updatedDepartment = await prisma.department.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        manager: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Soft delete a department
 * @route  DELETE /api/department/:id
 * @access Private (Owner or Admin only)
 */
export const softDeleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. First check if department exists and isn't deleted
    const department = await prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        deletedAt: true,
        managerId: true, // Important for maintaining referential integrity
      },
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

    // 2. Perform all operations in a transaction
    await prisma.$transaction([
      // Finally: Soft delete the department itself
      prisma.department.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Department soft deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Restore a soft-deleted department
 * @route  PATCH /api/department/:id/restore
 * @access Private (Owner or Admin only)
 */
export const restoreDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    // 1. Check if department exists and is deleted
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        organization: true,
        manager: true,
      },
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

    // 2. Verify permissions (Owner or Admin of the organization)
    // For ADMIN/OWNER, check if they belong to the department's organization
    const userInOrg = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: department.organizationId,
        role: { in: ['ADMIN', 'OWNER'] },
        deletedAt: null,
      },
    });

    if (!userInOrg) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to restore departments in this organization',
      });
    }

    // 3. Restore the department
    const restoredDepartment = await prisma.department.update({
      where: { id },
      data: {
        deletedAt: null,
      },
      include: {
        organization: { select: { id: true, name: true } },
        manager: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Department restored successfully',
      data: restoredDepartment,
    });
  } catch (error) {
    next(error);
  }
};
