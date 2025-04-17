import prisma from '../config/prismaClient.js';
import {
  createTaskValidation,
  updateTaskValidation,
} from '../validations/task.validation.js';

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
    const { organizationId, teamId, projectId } = req.params;
    const {
      title,
      description,
      priority,
      sprintId,
      assignedTo,
      dueDate,
      estimatedTime,
      parentId,
      labels,
    } = req.body;

    const user = req.user;

    const { error } = createTaskValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Validate required parameters
    const validation = validateParams(
      { title, projectId, organizationId, teamId, dueDate, priority },
      ['title', 'dueDate', 'priority'],
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // Check if organization exists
    const orgCheck = await checkOrganization(organizationId);
    if (!orgCheck.success) {
      return res.status(404).json({
        success: false,
        message: orgCheck.message,
      });
    }

    // Check if team exists
    const teamCheck = await checkTeam(teamId, organizationId);
    if (!teamCheck.success) {
      return res.status(404).json({
        success: false,
        message: teamCheck.message,
      });
    }

    // Check if project exists
    const projectCheck = await checkProject(projectId, teamId, organizationId);
    if (!projectCheck.success) {
      return res.status(404).json({
        success: false,
        message: projectCheck.message,
      });
    }

    // If sprintId is provided, verify the sprint exists and belongs to the project
    if (sprintId) {
      const sprint = await prisma.sprint.findFirst({
        where: {
          id: sprintId,
          projectId: projectId,
        },
      });

      if (!sprint) {
        return res.status(404).json({
          success: false,
          message:
            'Sprint not found or does not belong to the specified project',
        });
      }
    }

    // If parentId is provided, verify the parent task exists and belongs to the project
    if (parentId) {
      const parentTask = await prisma.task.findFirst({
        where: {
          id: parentId,
          projectId: projectId,
          deletedAt: null,
        },
      });

      if (!parentTask) {
        return res.status(404).json({
          success: false,
          message:
            'Parent task not found or does not belong to the specified project',
        });
      }
    }

    // If assignedTo is provided, verify the user exists
    if (assignedTo) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedTo },
      });

      if (!assignedUser) {
        return res.status(404).json({
          success: false,
          message: 'Assigned user not found',
        });
      }

      // Optional: Check if the user is a member of the project
      const isProjectMember = await prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: assignedTo,
        },
      });

      if (!isProjectMember) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user is not a member of the project',
        });
      }
    }

    // Check task permissions
    const permissionsCheck = checkTaskPermissions(
      user,
      orgCheck.organization,
      teamCheck.team,
      projectCheck.project,
      'create',
    );

    if (!permissionsCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionsCheck.message,
      });
    }

    // Calculate task order (place at the end)
    const lastTask = await prisma.task.findFirst({
      where: {
        projectId: projectId,
        sprintId: sprintId || null, // Consider sprint context if provided
        parentId: parentId || null, // Consider hierarchy if it's a subtask
        deletedAt: null,
      },
      orderBy: {
        order: 'desc',
      },
    });

    const order = lastTask ? lastTask.order + 1 : 0;

    // Create the task
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority,
        status: 'TODO', // Default status
        projectId,
        sprintId: sprintId || null,
        createdBy: user.id,
        assignedTo: assignedTo || null,
        dueDate: new Date(dueDate),
        estimatedTime: estimatedTime || null,
        parentId: parentId || null,
        order,
        labels: labels || [],
        lastModifiedBy: user.id,
      },
    });

    // Fetch project members
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      select: { id: true, projectId: true, userId: true, role: true },
    });

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task,
      project_members: projectMembers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update a task
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId
 * @method PUT
 * @access private
 */
export const updateTask = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, taskId } = req.params;
    const {
      title,
      description,
      priority,
      sprintId,
      assignedTo,
      dueDate,
      estimatedTime,
      parentId,
      labels,
    } = req.body;

    const user = req.user;

    const { error } = updateTaskValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Check if organization exists
    const orgCheck = await checkOrganization(organizationId);
    if (!orgCheck.success) {
      return res.status(404).json({
        success: false,
        message: orgCheck.message,
      });
    }

    // Check if team exists
    const teamCheck = await checkTeam(teamId, organizationId);
    if (!teamCheck.success) {
      return res.status(404).json({
        success: false,
        message: teamCheck.message,
      });
    }

    // Check if project exists
    const projectCheck = await checkProject(projectId, teamId, organizationId);
    if (!projectCheck.success) {
      return res.status(404).json({
        success: false,
        message: projectCheck.message,
      });
    }

    // Check if task exists and belongs to the project
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        projectId,
        deletedAt: null,
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    }

    // Check task permissions
    const permissionsCheck = checkTaskPermissions(
      user,
      orgCheck.organization,
      teamCheck.team,
      projectCheck.project,
      'update',
    );

    if (!permissionsCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionsCheck.message,
      });
    }

    // If sprintId is provided, verify the sprint exists and belongs to the project
    if (sprintId && sprintId !== task.sprintId) {
      const sprint = await prisma.sprint.findFirst({
        where: {
          id: sprintId,
          projectId,
        },
      });

      if (!sprint) {
        return res.status(404).json({
          success: false,
          message:
            'Sprint not found or does not belong to the specified project',
        });
      }
    }

    // If parentId is provided, verify the parent task exists, belongs to the project, and is not the task itself
    if (parentId && parentId !== task.parentId) {
      if (parentId === taskId) {
        return res.status(400).json({
          success: false,
          message: 'A task cannot be its own parent',
        });
      }

      const parentTask = await prisma.task.findFirst({
        where: {
          id: parentId,
          projectId,
          deletedAt: null,
        },
      });

      if (!parentTask) {
        return res.status(404).json({
          success: false,
          message:
            'Parent task not found or does not belong to the specified project',
        });
      }

      // Check for circular dependencies
      let currentParent = parentId;
      while (currentParent) {
        const parent = await prisma.task.findUnique({
          where: { id: currentParent },
          select: { parentId: true },
        });

        if (!parent) {
          return res.status(404).json({
            success: false,
            message: 'Parent task not found during circular dependency check',
          });
        }

        if (parent.parentId === taskId) {
          return res.status(400).json({
            success: false,
            message: 'Circular dependency detected in task hierarchy',
          });
        }

        currentParent = parent.parentId;
      }
    }

    // Update the task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: title !== undefined ? title : task.title,
        description: description !== undefined ? description : task.description,
        priority: priority !== undefined ? priority : task.priority,
        sprintId: sprintId !== undefined ? sprintId : task.sprintId,
        assignedTo: assignedTo !== undefined ? assignedTo : task.assignedTo,
        dueDate: dueDate !== undefined ? new Date(dueDate) : task.dueDate,
        estimatedTime:
          estimatedTime !== undefined ? estimatedTime : task.estimatedTime,
        parentId: parentId !== undefined ? parentId : task.parentId,
        labels: labels !== undefined ? labels : task.labels,
        updatedAt: new Date(),
        lastModifiedBy: user.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update the task priority
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/priority
 * @method PATCH
 * @access private
 */
export const updateTaskPriority = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, taskId } = req.params;
    const { priority } = req.body;
    const user = req.user;

    // Validate priority
    if (!priority || !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Valid priority (HIGH, MEDIUM, LOW) is required',
      });
    }

    // Check if organization exists
    const orgCheck = await checkOrganization(organizationId);
    if (!orgCheck.success) {
      return res.status(404).json({
        success: false,
        message: orgCheck.message,
      });
    }

    // Check if team exists
    const teamCheck = await checkTeam(teamId, organizationId);
    if (!teamCheck.success) {
      return res.status(404).json({
        success: false,
        message: teamCheck.message,
      });
    }

    // Check if project exists
    const projectCheck = await checkProject(projectId, teamId, organizationId);
    if (!projectCheck.success) {
      return res.status(404).json({
        success: false,
        message: projectCheck.message,
      });
    }

    // Check if task exists and belongs to the project
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        projectId,
        deletedAt: null,
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    }

    // Check task permissions
    const permissionsCheck = checkTaskPermissions(
      user,
      orgCheck.organization,
      teamCheck.team,
      projectCheck.project,
      'update priority',
    );

    if (!permissionsCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionsCheck.message,
      });
    }

    // Update task priority
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        priority,
        updatedAt: new Date(),
        lastModifiedBy: user.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Task priority updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};
