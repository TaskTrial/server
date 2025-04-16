import prisma from '../config/prismaClient';

/**
 * Helper function to validate required params
 * @param {Object} params - The parameters to validate
 * @param {Array} requiredParams - Array of required parameter names
 * @returns {Object} - Contains success flag and error message if validation fails
 */
const validateParams = (params, requiredParams) => {
  for (const param of requiredParams) {
    if (!params[param]) {
      return {
        success: false,
        message: `${param.charAt(0).toUpperCase() + param.slice(1)} ID is required`,
      };
    }
  }
  return { success: true };
};

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
 */
const checkTeam = async (teamId, organizationId, options = {}) => {
  const whereClause = {
    id: teamId,
    organizationId,
    deletedAt: null,
  };

  const team = await prisma.team.findFirst({
    where: whereClause,
    select: {
      id: true,
      name: true,
      description: true,
      createdBy: true,
      avatar: true,
      ...options.select,
    },
  });

  if (!team) {
    return {
      success: false,
      message: 'Team not found' + (options.notFoundSuffix || ''),
    };
  }

  return {
    success: true,
    team,
  };
};

/**
 * Helper function to check if project exists and is not deleted
 */
const checkProject = async (
  projectId,
  teamId,
  organizationId,
  options = {},
) => {
  const whereClause = {
    id: projectId,
    organizationId,
    teamId,
    deletedAt: null,
  };

  const project = await prisma.project.findFirst({
    where: whereClause,
    select: {
      id: true,
      name: true,
      description: true,
      createdBy: true,
      ...options.select,
    },
  });

  if (!project) {
    return {
      success: false,
      message: 'Project not found' + (options.notFoundSuffix || ''),
    };
  }

  return {
    success: true,
    project,
  };
};

/**
 * Helper function to check if team exists and is not deleted
 * @param {string} teamId - The team ID to check
 * @param {string} organizationId - The organization ID the team belongs to
 * @param {Object} [options] - Additional options for the query
 * @returns {Promise<Object>} - Contains success flag, error message, and team data
 */
const checkTaskPermissions = (user, organization, team, project, action) => {
  const isAdmin = user.role === 'ADMIN';
  const isOwner = organization.owners.some((owner) => owner.userId === user.id);
  const isTeamManager = team.createdBy === user.id;
  const isProjectCreator = project.createdBy === user.id;

  if (!isAdmin && !isOwner && !isTeamManager && !isProjectCreator) {
    return {
      success: false,
      message: `You do not have permission to ${action} this task`,
    };
  }

  return {
    success: true,
    isAdmin,
    isOwner,
    isTeamManager,
    isProjectCreator,
  };
};

/**
 * @desc   Create a new task
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/task/create
 * @method POST
 * @access private
 */
export const createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      priority,
      status,
      projectId,
      sprintId,
      assignedTo,
      dueDate,
      estimatedTime,
      parentId,
      labels,
      rate,
    } = req.body;

    const { organizationId, teamId } = req.params;
    const userId = req.user.id;

    // Validate required parameters
    const paramsValidation = validateParams(
      { organizationId, teamId, projectId, title, priority, status, dueDate },
      [
        'organizationId',
        'teamId',
        'projectId',
        'title',
        'priority',
        'status',
        'dueDate',
      ],
    );

    if (!paramsValidation.success) {
      return res.status(400).json({ message: paramsValidation.message });
    }

    // Check if organization exists
    const orgCheck = await checkOrganization(organizationId);
    if (!orgCheck.success) {
      return res.status(404).json({ message: orgCheck.message });
    }

    // Check if team exists
    const teamCheck = await checkTeam(teamId, organizationId);
    if (!teamCheck.success) {
      return res.status(404).json({ message: teamCheck.message });
    }

    // Check if project exists
    const projectCheck = await checkProject(projectId, teamId, organizationId);
    if (!projectCheck.success) {
      return res.status(404).json({ message: projectCheck.message });
    }

    // Check permissions
    const permissionCheck = checkTaskPermissions(
      req.user,
      orgCheck.organization,
      teamCheck.team,
      projectCheck.project,
      'create',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({ message: permissionCheck.message });
    }

    // Check if parent task exists (if provided)
    if (parentId) {
      const parentTask = await prisma.task.findFirst({
        where: {
          id: parentId,
          projectId,
          deletedAt: null,
        },
      });

      if (!parentTask) {
        return res.status(404).json({ message: 'Parent task not found' });
      }
    }

    // Check if assignee exists (if provided)
    if (assignedTo) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedTo },
      });

      if (!assignee) {
        return res.status(404).json({ message: 'Assigned user not found' });
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        status,
        rate,
        projectId,
        sprintId,
        createdBy: userId,
        assignedTo,
        dueDate: new Date(dueDate),
        estimatedTime,
        parentId,
        labels: labels || [],
        lastModifiedBy: userId,
      },
      include: {
        project: {
          select: { name: true },
        },
        sprint: {
          select: { name: true },
        },
        creator: {
          select: { name: true, email: true },
        },
        assignee: {
          select: { name: true, email: true },
        },
        parent: {
          select: { title: true, id: true },
        },
      },
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        action: 'CREATE',
        entityType: 'TASK',
        entityId: task.id,
        description: `Task "${task.title}" created`,
        performedBy: userId,
        projectId,
        organizationId,
      },
    });

    return res.status(201).json({
      message: 'Task created successfully',
      data: task,
    });
  } catch (error) {
    next(error);
  }
};
