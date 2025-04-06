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
