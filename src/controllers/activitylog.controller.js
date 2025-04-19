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

    if (!hasPermission.success) {
      return res.status(403).json({
        success: false,
        message: hasPermission.message,
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

/**
 * @desc   Get a specific activity log by ID
 * @route  /api/organization/:organizationId/activity-logs/:logId
 * @method GET
 * @access private
 */
export const getActivityLogById = async (req, res, next) => {
  try {
    const { organizationId, logId } = req.params;
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

    // Find the activity log
    const activityLog = await prisma.activityLog.findFirst({
      where: {
        id: logId,
        organizationId,
      },
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
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    if (!activityLog) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found',
      });
    }

    return res.status(200).json({
      success: true,
      activityLog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get activity feed for a specific entity (e.g., for a task or project)
 * @route  /api/organization/:organizationId/activity-feed
 * @method GET
 * @access private
 */
export const getActivityFeed = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { entityType, entityId, limit = 20, before } = req.query;

    // Check if organization exists
    const orgCheck = await checkOrganization(organizationId);
    if (!orgCheck.success) {
      return res.status(404).json({
        success: false,
        message: orgCheck.message,
      });
    }

    // Build where conditions based on entity type and ID
    const whereConditions = {
      organizationId,
    };

    // Filter by entity type and ID
    if (entityType && entityId) {
      switch (entityType) {
        case 'ORGANIZATION':
          // No additional filter needed since we already filter by organizationId
          break;
        case 'DEPARTMENT':
          whereConditions.departmentId = entityId;
          break;
        case 'TEAM':
          whereConditions.teamId = entityId;
          break;
        case 'PROJECT':
          whereConditions.projectId = entityId;
          break;
        case 'SPRINT':
          whereConditions.sprintId = entityId;
          break;
        case 'TASK':
          whereConditions.taskId = entityId;
          break;
        case 'USER':
          whereConditions.userId = entityId;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid entity type',
          });
      }
    }

    // For pagination using cursor-based approach (more efficient for feeds)
    if (before) {
      whereConditions.createdAt = {
        lt: new Date(before),
      };
    }

    // Get activity logs for the feed
    const activityFeed = await prisma.activityLog.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit),
    });

    // Get the last timestamp for next pagination
    const lastTimestamp =
      activityFeed.length > 0
        ? activityFeed[activityFeed.length - 1].createdAt.toISOString()
        : null;

    // Format activity feed for display
    const formattedFeed = activityFeed.map((log) => {
      // Create a user-friendly message based on action type
      const message = formatActivityLogMessage(log);

      return {
        id: log.id,
        message,
        user: log.user,
        entityType: log.entityType,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
        entityData: getEntityData(log),
      };
    });

    return res.status(200).json({
      success: true,
      activityFeed: formattedFeed,
      pagination: {
        nextCursor: lastTimestamp,
        hasMore: activityFeed.length === parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to format activity log messages
 * @param {Object} log - Activity log entry
 * @returns {String} Formatted message
 */
const formatActivityLogMessage = (log) => {
  const userName = `${log.user.firstName} ${log.user.lastName}`;

  switch (log.action) {
    case 'CREATED':
      return `${userName} created a new ${log.entityType.toLowerCase()}${log.task ? ` "${log.task.title}"` : ''}`;

    case 'UPDATED':
      return `${userName} updated ${log.entityType.toLowerCase()}${log.task ? ` "${log.task.title}"` : ''}`;

    case 'DELETED':
      return `${userName} deleted ${log.entityType.toLowerCase()}${log.task ? ` "${log.task.title}"` : ''}`;

    case 'RESTORED':
      return `${userName} restored ${log.entityType.toLowerCase()}${log.task ? ` "${log.task.title}"` : ''}`;

    case 'STATUS_CHANGED':
      const oldStatus = log.details?.oldStatus || 'previous status';
      const newStatus = log.details?.newStatus || 'new status';
      return `${userName} changed status from ${oldStatus} to ${newStatus}${log.task ? ` for "${log.task.title}"` : ''}`;

    case 'ASSIGNED':
      const assigneeName = log.details?.assigneeName || 'someone';
      return `${userName} assigned ${log.task ? `"${log.task.title}"` : 'a task'} to ${assigneeName}`;

    case 'UNASSIGNED':
      return `${userName} unassigned ${log.task ? `"${log.task.title}"` : 'a task'}`;

    case 'COMMENTED':
      return `${userName} commented on ${log.entityType.toLowerCase()}${log.task ? ` "${log.task.title}"` : ''}`;

    case 'ATTACHMENT_ADDED':
      return `${userName} added an attachment to ${log.entityType.toLowerCase()}${log.task ? ` "${log.task.title}"` : ''}`;

    case 'ATTACHMENT_REMOVED':
      return `${userName} removed an attachment from ${log.entityType.toLowerCase()}${log.task ? ` "${log.task.title}"` : ''}`;

    case 'SPRINT_STARTED':
      return `${userName} started sprint${log.sprint ? ` "${log.sprint.name}"` : ''}`;

    case 'SPRINT_COMPLETED':
      return `${userName} completed sprint${log.sprint ? ` "${log.sprint.name}"` : ''}`;

    case 'TASK_MOVED':
      const fromSprint = log.details?.from?.sprintName || 'previous sprint';
      const toSprint = log.details?.to?.sprintName || 'new sprint';
      return `${userName} moved ${log.task ? `"${log.task.title}"` : 'a task'} from ${fromSprint} to ${toSprint}`;

    case 'LOGGED_TIME':
      const time = log.details?.timeDetails?.hours || 'some time';
      return `${userName} logged ${time} hours on ${log.task ? `"${log.task.title}"` : 'a task'}`;

    default:
      return `${userName} performed ${log.action.toLowerCase()} on ${log.entityType.toLowerCase()}`;
  }
};

/**
 * Helper function to extract relevant entity data from a log
 * @param {Object} log - Activity log entry
 * @returns {Object} Entity data
 */
const getEntityData = (log) => {
  switch (log.entityType) {
    case 'TASK':
      return log.task;
    case 'PROJECT':
      return log.project;
    case 'SPRINT':
      return log.sprint;
    // Add other entity types as needed
    default:
      return null;
  }
};
