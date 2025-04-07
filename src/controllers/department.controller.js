import prisma from '../config/prismaClient.js';

/**
 * @desc   Get all departments
 * @route  GET /api/departments
 * @method GET
 * @access Private (Admin or Manager)
 */ export const getAllDepartments = async (req, res, next) => {
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
        deletedAt: null,
      },
    });
    //TODO: Check if the manager belongs to the same organization
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
