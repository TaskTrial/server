import prisma from '../config/prismaClient.js';

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
 * @param {Object} [options] - Additional options for the query
 * @returns {Promise<Object>} - Contains success flag, error message, and team data
 */
const checkUserPermission = (user, organization, action) => {
  const isAdmin = user.role === 'ADMIN';
  const isOwner = organization.owners.some((owner) => owner.userId === user.id);

  if (!isAdmin && !isOwner) {
    return {
      success: false,
      message: `You do not have permission to ${action} this task`,
    };
  }

  return {
    success: true,
    isAdmin,
    isOwner,
  };
};

/**
 * @desc   Get all activity logs with filtering options
 * @route  /api/organization/:organizationId/activity-logs
 * @method GET
 * @access private
 */
export const getAllActivityLogs = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const {
      entityType,
      action,
      userId,
      departmentId,
      teamId,
      projectId,
      sprintId,
      taskId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const user = req.user;

    // Check if organization exists
    const orgCheck = await checkOrganization(organizationId);
    if (!orgCheck.success) {
      return res.status(404).json({
        success: false,
        message: orgCheck.message,
      });
    }

    // Check user permissions for viewing logs
    const hasPermission = checkUserPermission(
      user,
      orgCheck.organization,
      'view activity logs',
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view activity logs',
      });
    }

    // Build filter conditions
    const whereConditions = {
      organizationId,
    };

    // Add optional filters if provided
    if (entityType) {
      whereConditions.entityType = entityType;
    }
    if (action) {
      whereConditions.action = action;
    }
    if (userId) {
      whereConditions.userId = userId;
    }
    if (departmentId) {
      whereConditions.departmentId = departmentId;
    }
    if (teamId) {
      whereConditions.teamId = teamId;
    }
    if (projectId) {
      whereConditions.projectId = projectId;
    }
    if (sprintId) {
      whereConditions.sprintId = sprintId;
    }
    if (taskId) {
      whereConditions.taskId = taskId;
    }

    // Date range filter
    if (startDate || endDate) {
      whereConditions.createdAt = {};
      if (startDate) {
        whereConditions.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereConditions.createdAt.lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Validate sort parameters
    const validSortFields = ['createdAt', 'entityType', 'action'];
    const validSortOrders = ['asc', 'desc'];

    const actualSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const actualSortOrder = validSortOrders.includes(sortOrder)
      ? sortOrder
      : 'desc';

    // Get total count for pagination
    const totalCount = await prisma.activityLog.count({
      where: whereConditions,
    });

    // Get activity logs with pagination and sorting
    const activityLogs = await prisma.activityLog.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePic: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        department:
          entityType === 'DEPARTMENT'
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : undefined,
        team:
          entityType === 'TEAM'
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : undefined,
        project:
          entityType === 'PROJECT'
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : undefined,
        sprint:
          entityType === 'SPRINT'
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : undefined,
        task:
          entityType === 'TASK'
            ? {
                select: {
                  id: true,
                  title: true,
                },
              }
            : undefined,
      },
      orderBy: {
        [actualSortBy]: actualSortOrder,
      },
      skip,
      take: parseInt(limit),
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPreviousPage = parseInt(page) > 1;

    return res.status(200).json({
      success: true,
      count: activityLogs.length,
      total: totalCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        hasNextPage,
        hasPreviousPage,
        limit: parseInt(limit),
      },
      activityLogs,
    });
  } catch (error) {
    next(error);
  }
};
