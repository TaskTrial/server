import prisma from '../config/prismaClient.js';
import {
  createTaskValidation,
  updateTaskValidation,
} from '../validations/task.validation.js';
import {
  createActivityLog,
  generateActivityDetails,
} from '../utils/activityLogs.utils.js';

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

    // Log the activity
    await createActivityLog({
      entityType: 'TASK',
      action: 'CREATED',
      userId: user.id,
      organizationId,
      teamId,
      projectId,
      sprintId: sprintId || null,
      taskId: task.id,
      details: generateActivityDetails('CREATED', null, task),
    });

    // If task is assigned to someone, log that action too
    if (assignedTo) {
      await createActivityLog({
        entityType: 'TASK',
        action: 'ASSIGNED',
        userId: user.id,
        organizationId,
        teamId,
        projectId,
        sprintId: sprintId || null,
        taskId: task.id,
        details: generateActivityDetails('ASSIGNED', null, {
          assignedTo,
          taskId: task.id,
        }),
      });
    }

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
      status,
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

    // Save old task data for activity logging
    const oldTaskData = { ...task };

    // Update the task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: title !== undefined ? title : task.title,
        description: description !== undefined ? description : task.description,
        status: status !== undefined ? status : task.status,
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

    // Log the general update activity
    await createActivityLog({
      entityType: 'TASK',
      action: 'UPDATED',
      userId: user.id,
      organizationId,
      teamId,
      projectId,
      sprintId: updatedTask.sprintId || null,
      taskId: updatedTask.id,
      details: generateActivityDetails('UPDATED', oldTaskData, updatedTask),
    });

    // Assignment change
    if (assignedTo !== undefined && assignedTo !== oldTaskData.assignedTo) {
      if (assignedTo === null) {
        // Task was unassigned
        await createActivityLog({
          entityType: 'TASK',
          action: 'UNASSIGNED',
          userId: user.id,
          organizationId,
          teamId,
          projectId,
          sprintId: updatedTask.sprintId || null,
          taskId: updatedTask.id,
          details: generateActivityDetails('UNASSIGNED', oldTaskData, null),
        });
      } else if (oldTaskData.assignedTo === null) {
        // Task was assigned
        await createActivityLog({
          entityType: 'TASK',
          action: 'ASSIGNED',
          userId: user.id,
          organizationId,
          teamId,
          projectId,
          sprintId: updatedTask.sprintId || null,
          taskId: updatedTask.id,
          details: generateActivityDetails('ASSIGNED', null, {
            assignedTo,
            taskId: updatedTask.id,
          }),
        });
      } else {
        // Assignment was changed
        await createActivityLog({
          entityType: 'TASK',
          action: 'UNASSIGNED',
          userId: user.id,
          organizationId,
          teamId,
          projectId,
          sprintId: updatedTask.sprintId || null,
          taskId: updatedTask.id,
          details: generateActivityDetails('UNASSIGNED', oldTaskData, null),
        });

        await createActivityLog({
          entityType: 'TASK',
          action: 'ASSIGNED',
          userId: user.id,
          organizationId,
          teamId,
          projectId,
          sprintId: updatedTask.sprintId || null,
          taskId: updatedTask.id,
          details: generateActivityDetails('ASSIGNED', null, {
            assignedTo,
            taskId: updatedTask.id,
          }),
        });
      }
    }

    // Sprint change
    if (sprintId !== undefined && sprintId !== oldTaskData.sprintId) {
      await createActivityLog({
        entityType: 'TASK',
        action: 'TASK_MOVED',
        userId: user.id,
        organizationId,
        teamId,
        projectId,
        sprintId: updatedTask.sprintId || null,
        taskId: updatedTask.id,
        details: generateActivityDetails(
          'TASK_MOVED',
          oldTaskData,
          updatedTask,
        ),
      });
    }

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

    const oldTaskData = { ...task };

    // Update task priority
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        priority,
        updatedAt: new Date(),
        lastModifiedBy: user.id,
      },
    });

    // Status change
    if (priority && priority !== oldTaskData.priority) {
      await createActivityLog({
        entityType: 'TASK',
        action: 'STATUS_CHANGED',
        userId: user.id,
        organizationId,
        teamId,
        projectId,
        sprintId: updatedTask.sprintId || null,
        taskId: updatedTask.id,
        details: generateActivityDetails(
          'STATUS_CHANGED',
          oldTaskData,
          updatedTask,
        ),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Task priority updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update a task status
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/status
 * @method PATCH
 * @access private
 */
export const updateTaskStatus = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, taskId } = req.params;
    const { status } = req.body;
    const user = req.user;

    // Validate status
    const validStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Valid status (${validStatuses.join(', ')}) is required`,
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
      'update status',
    );

    if (!permissionsCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionsCheck.message,
      });
    }

    const oldTaskData = { ...task };

    // Update task status
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        updatedAt: new Date(),
        lastModifiedBy: user.id,
      },
    });

    // Status change
    if (status && status !== oldTaskData.status) {
      await createActivityLog({
        entityType: 'TASK',
        action: 'STATUS_CHANGED',
        userId: user.id,
        organizationId,
        teamId,
        projectId,
        sprintId: updatedTask.sprintId || null,
        taskId: updatedTask.id,
        details: generateActivityDetails(
          'STATUS_CHANGED',
          oldTaskData,
          updatedTask,
        ),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all tasks
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/task/all
 * @method GET
 * @access private
 */
export const getAllTasks = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const {
      sprintId,
      priority,
      status,
      assignedTo,
      parentId,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

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

    // Build filter conditions
    const whereClause = {
      projectId,
      deletedAt: null,
    };

    // Apply optional filters
    if (sprintId) {
      whereClause.sprintId = sprintId === 'null' ? null : sprintId;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (status) {
      whereClause.status = status;
    }

    if (assignedTo) {
      whereClause.assignedTo = assignedTo === 'null' ? null : assignedTo;
    }

    if (parentId) {
      whereClause.parentId = parentId === 'null' ? null : parentId;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Determine sort order
    const orderBy = {};
    orderBy[sortBy] = sortOrder.toLowerCase();

    // Get total count for pagination
    const totalCount = await prisma.task.count({ where: whereClause });

    // Get tasks with related data
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePic: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePic: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        subtasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
        parent: parentId
          ? {
              select: {
                id: true,
                title: true,
                status: true,
              },
            }
          : false,
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy,
      skip,
      take: parseInt(limit),
    });

    return res.status(200).json({
      success: true,
      tasks,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get a task by id
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId
 * @method GET
 * @access private
 */
export const getSpecificTask = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, taskId } = req.params;

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

    // Get detailed task information
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        projectId,
        deletedAt: null,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePic: true,
          },
        },
        modifier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePic: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePic: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        subtasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            assignedTo: true,
            dueDate: true,
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        parent: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
        dependentOn: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        dependencies: {
          include: {
            dependentTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        comments: {
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePic: true,
              },
            },
          },
        },
        attachments: {
          include: {
            uploader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePic: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete a task
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/delete
 * @method DELETE
 * @access private
 */
export const deleteTask = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, taskId } = req.params;
    const { permanent = false } = req.query;
    const user = req.user;

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
      include: {
        subtasks: {
          where: { deletedAt: null },
          select: { id: true },
        },
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
      'delete',
    );

    if (!permissionsCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionsCheck.message,
      });
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (prisma) => {
      // Log the delete activity BEFORE deleting the task
      await createActivityLog({
        entityType: 'TASK',
        action: 'DELETED',
        userId: user.id,
        organizationId,
        teamId,
        projectId,
        sprintId: task.sprintId || null,
        taskId: task.id,
        details: generateActivityDetails('DELETED', task, null),
      });

      if (permanent) {
        if (!permissionsCheck.isAdmin && !permissionsCheck.isOwner) {
          throw new Error(
            'Only administrators or organization owners can permanently delete tasks',
          );
        }

        await prisma.taskAttachment.deleteMany({ where: { taskId } });
        await prisma.comment.deleteMany({ where: { taskId } });
        await prisma.taskDependency.deleteMany({
          where: {
            OR: [{ taskId }, { dependentTaskId: taskId }],
          },
        });
        await prisma.timelog.deleteMany({ where: { taskId } });
        await prisma.activityLog.deleteMany({ where: { taskId } });

        // Bulk delete all subtasks
        await prisma.task.deleteMany({ where: { parentId: taskId } });

        // Finally delete the task itself
        await prisma.task.delete({ where: { id: taskId } });
      } else {
        // Soft delete - mark as deleted but keep in database
        const now = new Date();

        // Soft delete all subtasks first
        if (task.subtasks && task.subtasks.length > 0) {
          await prisma.task.updateMany({
            where: { parentId: taskId, deletedAt: null },
            data: {
              deletedAt: now,
              lastModifiedBy: user.id,
            },
          });
        }

        // Soft delete the task itself
        await prisma.task.update({
          where: { id: taskId },
          data: {
            deletedAt: now,
            lastModifiedBy: user.id,
          },
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: `Task ${permanent ? 'permanently ' : ''}deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Restore a task
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/restore
 * @method PATCH
 * @access private
 */
export const restoreTask = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, taskId } = req.params;
    const { restoreSubtasks = true } = req.body;
    const user = req.user;

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

    // Check if task exists, is deleted, and belongs to the project
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        projectId,
        deletedAt: { not: null }, // Must be deleted to restore
      },
      include: {
        subtasks: {
          where: { deletedAt: { not: null } }, // Only include deleted subtasks
          select: { id: true },
        },
        parent: {
          select: {
            id: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message:
          'Task not found, already active, or does not belong to the specified project',
      });
    }

    // Check task permissions
    const permissionsCheck = checkTaskPermissions(
      user,
      orgCheck.organization,
      teamCheck.team,
      projectCheck.project,
      'restore',
    );

    if (!permissionsCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionsCheck.message,
      });
    }

    // Check if parent task exists and is not deleted (if applicable)
    if (task.parent && task.parent.deletedAt) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot restore task because its parent task is deleted. Please restore the parent task first.',
      });
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (prisma) => {
      // Restore the task
      await prisma.task.update({
        where: { id: taskId },
        data: {
          deletedAt: null,
          lastModifiedBy: user.id,
          updatedAt: new Date(),
        },
      });

      // Restore subtasks if requested
      if (restoreSubtasks && task.subtasks && task.subtasks.length > 0) {
        const subtaskIds = task.subtasks.map((subtask) => subtask.id);

        await prisma.task.updateMany({
          where: {
            id: { in: subtaskIds },
            deletedAt: { not: null },
          },
          data: {
            deletedAt: null,
            lastModifiedBy: user.id,
            updatedAt: new Date(),
          },
        });
      }
    });

    // Fetch the updated task to return in the response
    const restoredTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
        },
        _count: {
          select: {
            subtasks: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    // Log the restore activity
    await createActivityLog({
      entityType: 'TASK',
      action: 'UPDATED', // Using UPDATED with specific details
      userId: user.id,
      organizationId,
      teamId,
      projectId,
      sprintId: restoredTask.sprintId || null,
      taskId: restoredTask.id,
      details: {
        action: 'RESTORE',
        restoredAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Task restored successfully${restoreSubtasks ? ' with its subtasks' : ''}`,
      task: restoredTask,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get tasks in a specific organization
 * @route  /api/organization/:organizationId/tasks
 * @method GET
 * @access private
 */
export const getTasksInSpecificOrg = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const {
      projectId,
      projectName,
      assignedTo,
      status,
      priority,
      page = 1,
      limit = 10,
      includeSubtasks = 'true',
    } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Check if organization exists
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            teams: true,
            projects: true,
            templates: true,
          },
        },
        users: {
          where: {
            id: req.user.id,
          },
          take: 1,
        },
        owners: {
          select: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check permissions for non-admin users
    if (req.user.role !== 'ADMIN') {
      // Check if user is an owner
      const isOwner = organization.owners.some(
        (owner) => owner.user.id === req.user.id,
      );

      // Check if user is a member
      const isMember = organization.users.some(
        (user) => user.id === req.user.id,
      );

      if (!isOwner && !isMember) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this organization',
        });
      }
    }

    // Build the where clause for tasks query
    const whereClause = {
      project: {
        organizationId,
      },
      deletedAt: null,
    };

    // Add project filter if projectId or projectName is provided
    if (projectId || projectName) {
      // Find the project
      const projectWhereClause = {
        organizationId,
        deletedAt: null,
      };

      if (projectId) {
        projectWhereClause.id = projectId;
      } else if (projectName) {
        projectWhereClause.name = {
          contains: projectName,
          mode: 'insensitive',
        };
      }

      const project = await prisma.project.findFirst({
        where: projectWhereClause,
        select: {
          id: true,
        },
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: projectId
            ? 'Project not found'
            : 'No project matching the provided name',
        });
      }

      whereClause.projectId = project.id;
    }

    // Add assignedTo filter if provided
    if (assignedTo) {
      if (assignedTo === 'me') {
        whereClause.assignedTo = req.user.id;
      } else if (assignedTo === 'unassigned') {
        whereClause.assignedTo = null;
      } else {
        whereClause.assignedTo = assignedTo;
      }
    }

    // Add status filter if provided - ensure it matches the TaskStatus enum in Prisma
    if (status) {
      // Make sure status is one of the valid enum values
      const validStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
      if (validStatuses.includes(status)) {
        whereClause.status = status;
      } else {
        // If invalid status is provided, return a helpful error
        return res.status(400).json({
          success: false,
          message: `Invalid status value. Expected one of: ${validStatuses.join(', ')}`,
        });
      }
    }

    // Add priority filter if provided
    if (priority) {
      // Make sure priority is one of the valid enum values
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
      if (validPriorities.includes(priority)) {
        whereClause.priority = priority;
      } else {
        // If invalid priority is provided, return a helpful error
        return res.status(400).json({
          success: false,
          message: `Invalid priority value. Expected one of: ${validPriorities.join(', ')}`,
        });
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filter for parent tasks (non-subtasks)
    if (includeSubtasks !== 'true') {
      whereClause.parentId = null;
    }

    // Build the include object for the tasks query
    const includeObj = {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePic: true,
        },
      },
      assignee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePic: true,
        },
      },
      _count: {
        select: {
          comments: true,
          attachments: true,
          subtasks: {
            where: {
              deletedAt: null,
            },
          },
          timelogs: true,
        },
      },
    };

    // Include subtasks if requested
    if (includeSubtasks === 'true') {
      includeObj.subtasks = {
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          dueDate: true,
          estimatedTime: true,
          actualTime: true,
          labels: true,
          assignedTo: true,
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: 5, // Limit to 5 subtasks per task
      };
    }

    // Get active tasks (not deleted)
    const activeTasks = await prisma.task.findMany({
      where: whereClause,
      include: includeObj,
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { updatedAt: 'desc' },
      ],
      skip,
      take: parseInt(limit),
    });

    // Count total active tasks for pagination
    const totalActiveTasks = await prisma.task.count({
      where: whereClause,
    });

    // Format tasks
    const formattedTasks = activeTasks.map((task) => {
      // Calculate completion status for subtasks
      const subtaskStats = {
        total: task._count.subtasks,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        overdue: 0,
      };

      let formattedSubtasks = [];

      if (includeSubtasks === 'true' && task.subtasks) {
        // Format subtasks and calculate statistics
        formattedSubtasks = task.subtasks.map((subtask) => {
          // Track subtask status
          if (subtask.status === 'DONE') {
            subtaskStats.done++;
          } else if (subtask.status === 'IN_PROGRESS') {
            subtaskStats.inProgress++;
          } else if (subtask.status === 'TODO') {
            subtaskStats.todo++;
          } else if (subtask.status === 'REVIEW') {
            subtaskStats.review++;
          }

          // Check for overdue subtasks
          const isOverdue =
            subtask.dueDate < new Date() && subtask.status !== 'DONE';
          if (isOverdue) {
            subtaskStats.overdue++;
          }

          return {
            id: subtask.id,
            title: subtask.title,
            description: subtask.description,
            priority: subtask.priority,
            status: subtask.status,
            dueDate: subtask.dueDate,
            estimatedTime: subtask.estimatedTime,
            actualTime: subtask.actualTime,
            labels: subtask.labels,
            commentCount: subtask._count.comments,
            attachmentCount: subtask._count.attachments,
            assignee: subtask.assignee
              ? {
                  id: subtask.assignee.id,
                  firstName: subtask.assignee.firstName,
                  lastName: subtask.assignee.lastName,
                  profilePic: subtask.assignee.profilePic,
                }
              : null,
            isOverdue,
          };
        });
      }

      // Calculate completion percentage
      const completionPercentage =
        subtaskStats.total > 0
          ? Math.round((subtaskStats.completed / subtaskStats.total) * 100)
          : task.status === 'DONE'
            ? 100
            : task.status === 'IN_PROGRESS'
              ? 50
              : 0;

      // Calculate if task is overdue
      const isOverdue = task.dueDate < new Date() && task.status !== 'DONE';

      // Calculate time tracking stats
      const estimatedTime = task.estimatedTime || 0;
      const actualTime = task.actualTime || 0;
      const timeRemaining = Math.max(0, estimatedTime - actualTime);
      const timeProgress =
        estimatedTime > 0 ? (actualTime / estimatedTime) * 100 : 0;

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        estimatedTime,
        actualTime,
        timeRemaining,
        timeProgress: Math.min(100, timeProgress),
        labels: task.labels,
        project: task.project,
        creator: task.creator,
        assignee: task.assignee,
        commentCount: task._count.comments,
        attachmentCount: task._count.attachments,
        timelogCount: task._count.timelogs,
        isOverdue,
        progress: completionPercentage,
        subtaskStats,
        subtasks: includeSubtasks === 'true' ? formattedSubtasks : undefined,
        hasMoreSubtasks:
          task._count.subtasks > (formattedSubtasks?.length || 0),
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalActiveTasks / parseInt(limit));

    // Get task counts by status
    const taskCountsByStatus = {
      todo: await prisma.task.count({
        where: {
          ...whereClause,
          status: 'TODO',
        },
      }),
      inProgress: await prisma.task.count({
        where: {
          ...whereClause,
          status: 'IN_PROGRESS',
        },
      }),
      review: await prisma.task.count({
        where: {
          ...whereClause,
          status: 'REVIEW',
        },
      }),
      done: await prisma.task.count({
        where: {
          ...whereClause,
          status: 'DONE',
        },
      }),
    };

    // Get task counts by priority
    const taskCountsByPriority = {
      low: await prisma.task.count({
        where: {
          ...whereClause,
          priority: 'LOW',
        },
      }),
      medium: await prisma.task.count({
        where: {
          ...whereClause,
          priority: 'MEDIUM',
        },
      }),
      high: await prisma.task.count({
        where: {
          ...whereClause,
          priority: 'HIGH',
        },
      }),
    };

    // Count overdue tasks
    const overdueTasks = await prisma.task.count({
      where: {
        ...whereClause,
        dueDate: {
          lt: new Date(),
        },
        status: {
          not: 'DONE',
        },
      },
    });

    // Format and return response
    return res.status(200).json({
      success: true,
      message: `Organization's tasks retrieved successfully`,
      data: {
        tasks: formattedTasks,
        statistics: {
          totalTasks: totalActiveTasks,
          byStatus: taskCountsByStatus,
          byPriority: taskCountsByPriority,
          overdue: overdueTasks,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages,
          totalItems: totalActiveTasks,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
