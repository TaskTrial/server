import prisma from '../config/prismaClient.js';
import {
  sprintvalidation,
  updateSprintStatusValidation,
  updateSprintValidation,
} from '../validations/sprint.validation.js';
import {
  createActivityLog,
  generateActivityDetails,
} from '../utils/activityLogs.utils.js';

/**
 * Validate required parameters
 * @param {Object} params - Parameters to validate
 * @param {Array} requiredParams - Required parameter names
 * @returns {Object} - Validation result
 */
const validateParams = (params, requiredParams) => {
  for (const param of requiredParams) {
    if (!params[param]) {
      return {
        success: false,
        message: `${param.charAt(0).toUpperCase() + param.slice(1)} is required`,
      };
    }
  }
  return { success: true };
};

/**
 * Check if project exists and user has access
 * @param {string} projectId - Project ID
 * @param {string} organizationId - Organization ID
 * @param {string} teamId - Team ID
 * @param {Object} user - User object
 * @returns {Promise<Object>} - Contains project, organization and permission info
 */
const checkProjectAccess = async (projectId, organizationId, teamId, user) => {
  // Check if organization exists
  const organization = await prisma.organization.findFirst({
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

  if (!organization) {
    return {
      success: false,
      message: 'Organization not found',
    };
  }

  // Check if team exists
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      organizationId,
      deletedAt: null,
    },
  });

  if (!team) {
    return {
      success: false,
      message: 'Team not found',
    };
  }

  // Check if project exists
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      teamId,
      organizationId,
      deletedAt: null,
    },
    include: {
      ProjectMember: {
        where: {
          userId: user.id,
          leftAt: null,
        },
        select: {
          role: true,
        },
      },
    },
  });

  if (!project) {
    return {
      success: false,
      message: 'Project not found',
    };
  }

  // Check permissions
  const isAdmin = user.role === 'ADMIN';
  const isOrgOwner = organization.owners.some(
    (owner) => owner.userId === user.id,
  );
  const isTeamManager = team.createdBy === user.id;
  const isProjectOwner = project.ProjectMember.some(
    (m) => m.role === 'PROJECT_OWNER',
  );
  const isProjectManager = project.ProjectMember.some(
    (m) => m.role === 'PROJECT_MANAGER',
  );

  const hasPermission =
    isAdmin ||
    isOrgOwner ||
    isTeamManager ||
    isProjectOwner ||
    isProjectManager;

  return {
    success: true,
    project,
    organization,
    team,
    hasPermission,
    isAdmin,
    isOrgOwner,
    isTeamManager,
    isProjectOwner,
    isProjectManager,
  };
};

/**
 * Validate sprint dates
 * @param {Date} startDate - Sprint start date
 * @param {Date} endDate - Sprint end date
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} - Validation result
 */
const validateSprintDates = async (startDate, endDate, projectId) => {
  // Basic date validation
  if (new Date(startDate) >= new Date(endDate)) {
    return {
      success: false,
      message: 'Start date must be before end date',
    };
  }

  // Check for overlapping sprints
  const overlappingSprint = await prisma.sprint.findFirst({
    where: {
      projectId,
      OR: [
        {
          // New sprint starts during existing sprint
          startDate: { lte: new Date(endDate) },
          endDate: { gte: new Date(startDate) },
        },
        {
          // New sprint encompasses existing sprint
          startDate: { gte: new Date(startDate) },
          endDate: { lte: new Date(endDate) },
        },
      ],
    },
  });

  if (overlappingSprint) {
    return {
      success: false,
      message: 'Sprint dates overlap with existing sprint',
      overlappingSprint,
    };
  }

  return { success: true };
};

/**
 * Determine sprint status based on dates
 * @param {Date} startDate - Sprint start date
 * @param {Date} endDate - Sprint end date
 * @returns {string} - Sprint status
 */
const calculateSprintStatus = (startDate, endDate) => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) {
    return 'PLANNING';
  }
  if (now >= start && now <= end) {
    return 'ACTIVE';
  }
  return 'COMPLETED';
};

/**
 * @desc   Create a new sprint
 * @route  POST /api/organization/:organizationId/team/:teamId/project/:projectId/sprint
 * @method POST
 * @access private
 */
export const createSprint = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const user = req.user;

    // Validate required parameters
    const paramsValidation = validateParams(
      { organizationId, teamId, projectId },
      ['organizationId', 'teamId', 'projectId'],
    );

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: paramsValidation.message,
      });
    }

    // Check project access and permissions
    const accessCheck = await checkProjectAccess(
      projectId,
      organizationId,
      teamId,
      user,
    );
    if (!accessCheck.success) {
      return res
        .status(accessCheck.message.includes('not found') ? 404 : 403)
        .json({
          success: false,
          message: accessCheck.message,
        });
    }

    if (!accessCheck.hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create sprints in this project',
      });
    }

    // Validate input
    const { error } = sprintvalidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((e) => e.message),
      });
    }

    const { name, description, startDate, endDate, goal } = req.body;

    // Validate sprint dates
    const dateValidation = await validateSprintDates(
      startDate,
      endDate,
      projectId,
    );
    if (!dateValidation.success) {
      return res.status(400).json({
        success: false,
        message: dateValidation.message,
        data: dateValidation.overlappingSprint
          ? { overlappingSprint: dateValidation.overlappingSprint }
          : undefined,
      });
    }

    // Calculate status based on dates
    const status = calculateSprintStatus(startDate, endDate);

    try {
      // Get the highest current order value to place new sprint at the end
      const lastSprint = await prisma.sprint.findFirst({
        where: {
          projectId,
        },
        orderBy: {
          order: 'desc',
        },
        select: {
          order: true,
        },
      });

      const newOrder = lastSprint ? lastSprint.order + 1 : 0;

      // Create the sprint
      const sprint = await prisma.sprint.create({
        data: {
          name,
          description,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status,
          goal,
          order: newOrder,
          projectId,
        },
      });

      await createActivityLog({
        entityType: 'SPRINT',
        action: 'CREATED',
        userId: user.id,
        organizationId,
        teamId,
        projectId,
        sprintId: sprint.id,
        details: {
          sprint: {
            id: sprint.id,
            name: sprint.name,
            description: sprint.description,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            status: sprint.status,
            goal: sprint.goal,
            order: sprint.order,
            projectId: sprint.projectId,
            createdAt: sprint.createdAt,
          },
          createdBy: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
          },
        },
      });

      res.status(201).json({
        success: true,
        message: 'Sprint created successfully',
        data: sprint,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'A sprint with this name already exists in this project',
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update a sprint
 * @route  PUT /api/organization/:organizationId/team/:teamId/project/:projectId/sprint/:sprintId
 * @method PUT
 * @access private
 */
export const updateSprint = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, sprintId } = req.params;
    const user = req.user;

    // Validate required parameters
    const paramsValidation = validateParams(
      { organizationId, teamId, projectId, sprintId },
      ['organizationId', 'teamId', 'projectId', 'sprintId'],
    );

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: paramsValidation.message,
      });
    }

    // Check project access and permissions
    const accessCheck = await checkProjectAccess(
      projectId,
      organizationId,
      teamId,
      user,
    );
    if (!accessCheck.success) {
      return res
        .status(accessCheck.message.includes('not found') ? 404 : 403)
        .json({
          success: false,
          message: accessCheck.message,
        });
    }

    if (!accessCheck.hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update sprints in this project',
      });
    }

    // Validate input
    const { error } = updateSprintValidation.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((e) => e.message),
      });
    }

    // Check if sprint exists
    const existingSprint = await prisma.sprint.findFirst({
      where: {
        id: sprintId,
        projectId,
      },
    });

    if (!existingSprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found',
      });
    }

    const { name, description, startDate, endDate, goal, status, order } =
      req.body;

    // Prepare update data
    const updateData = {
      lastModifiedAt: new Date(), // Track the last modification timestamp
    };

    if (name !== undefined) {
      // Check for name uniqueness if name is being updated
      if (name !== existingSprint.name) {
        const duplicateSprint = await prisma.sprint.findFirst({
          where: {
            projectId,
            name,
            id: { not: sprintId },
          },
        });

        if (duplicateSprint) {
          return res.status(400).json({
            success: false,
            message: 'A sprint with this name already exists in this project',
          });
        }
      }
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description;
    }
    if (goal !== undefined) {
      updateData.goal = goal;
    }
    if (status !== undefined) {
      updateData.status = status;
    }
    if (order !== undefined) {
      updateData.order = order;
    }

    // Handle date updates
    let newStartDate = existingSprint.startDate;
    let newEndDate = existingSprint.endDate;
    let shouldRecalculateStatus = false;

    if (startDate !== undefined) {
      newStartDate = new Date(startDate);
      updateData.startDate = newStartDate;
      shouldRecalculateStatus = true;
    }

    if (endDate !== undefined) {
      newEndDate = new Date(endDate);
      updateData.endDate = newEndDate;
      shouldRecalculateStatus = true;
    }

    // Validate dates if either is being updated
    if (startDate !== undefined || endDate !== undefined) {
      // Basic date validation
      if (newStartDate >= newEndDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date',
        });
      }

      // Check for overlapping sprints (excluding current sprint)
      const overlappingSprint = await prisma.sprint.findFirst({
        where: {
          projectId,
          id: { not: sprintId },
          OR: [
            {
              startDate: { lte: newEndDate },
              endDate: { gte: newStartDate },
            },
            {
              startDate: { gte: newStartDate },
              endDate: { lte: newEndDate },
            },
          ],
        },
      });

      if (overlappingSprint) {
        return res.status(400).json({
          success: false,
          message: 'Sprint dates overlap with existing sprint',
          data: { overlappingSprint },
        });
      }

      // Recalculate status if dates changed
      if (shouldRecalculateStatus && status === undefined) {
        updateData.status = calculateSprintStatus(newStartDate, newEndDate);
      }
    }

    // Update the sprint
    const updatedSprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: updateData,
    });

    await createActivityLog({
      entityType: 'SPRINT',
      action: 'UPDATED',
      userId: user.id,
      organizationId,
      teamId,
      projectId,
      sprintId: updatedSprint.id,
      details: generateActivityDetails(
        'UPDATED',
        existingSprint,
        updatedSprint,
      ),
    });

    res.status(200).json({
      success: true,
      message: 'Sprint updated successfully',
      data: updatedSprint,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A sprint with this name already exists in this project',
      });
    }
    next(error);
  }
};

/**
 * @desc   Update sprint status
 * @route  PATCH /api/organization/:organizationId/team/:teamId/project/:projectId/sprint/:sprintId/status
 * @method PATCH
 * @access private
 */
export const updateSprintStatus = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, sprintId } = req.params;
    const { status } = req.body;
    const user = req.user;

    // Validate required parameters
    const paramsValidation = validateParams(
      { organizationId, teamId, projectId, sprintId, status },
      ['organizationId', 'teamId', 'projectId', 'sprintId', 'status'],
    );

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: paramsValidation.message,
      });
    }

    // Check project access and permissions
    const accessCheck = await checkProjectAccess(
      projectId,
      organizationId,
      teamId,
      user,
    );
    if (!accessCheck.success) {
      return res
        .status(accessCheck.message.includes('not found') ? 404 : 403)
        .json({
          success: false,
          message: accessCheck.message,
        });
    }

    // Validate input
    const { error } = updateSprintStatusValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((e) => e.message),
      });
    }

    // Check if sprint exists and get current status
    const existingSprint = await prisma.sprint.findFirst({
      where: {
        id: sprintId,
        projectId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        projectId: true,
      },
    });

    if (!existingSprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found',
      });
    }

    // Define valid status transitions
    const validTransitions = {
      PLANNING: ['ACTIVE', 'COMPLETED'],
      ACTIVE: ['COMPLETED'],
      COMPLETED: [], // No transitions allowed from COMPLETED
    };

    // Check if transition is valid
    if (!validTransitions[existingSprint.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${existingSprint.status} to ${status}`,
        validTransitions: validTransitions[existingSprint.status],
      });
    }

    // Additional validation for ACTIVE status
    if (status === 'ACTIVE') {
      const now = new Date();
      if (now < new Date(existingSprint.startDate)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot activate sprint before its start date',
        });
      }
    }

    // Additional validation for COMPLETED status
    if (status === 'COMPLETED') {
      const incompleteTasks = await prisma.task.count({
        where: {
          sprintId,
          status: { not: 'DONE' },
          deletedAt: null,
        },
      });

      if (incompleteTasks > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot complete sprint with unfinished tasks',
          incompleteTasks,
        });
      }
    }

    // Update the sprint status
    const updatedSprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status,
        // Auto-update dates if transitioning to ACTIVE/COMPLETED
        ...(status === 'ACTIVE' && { startDate: new Date() }),
        ...(status === 'COMPLETED' && { endDate: new Date() }),
      },
      include: {
        project: {
          select: {
            name: true,
          },
        },
      },
    });

    await createActivityLog({
      entityType: 'SPRINT',
      action: 'STATUS_CHANGED',
      userId: user.id,
      organizationId,
      teamId,
      projectId,
      sprintId: updatedSprint.id,
      details: {
        oldStatus: existingSprint.status,
        newStatus: updatedSprint.status,
        sprint: {
          id: updatedSprint.id,
          name: updatedSprint.name,
          startDate: updatedSprint.startDate,
          endDate: updatedSprint.endDate,
          projectId: updatedSprint.projectId,
        },
        changedBy: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Sprint status updated successfully',
      data: {
        ...updatedSprint,
        // Include relevant metadata
        updatedBy: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all sprints for a project
 * @route  GET /api/organization/:organizationId/team/:teamId/project/:projectId/sprints
 * @method GET
 * @access private
 */
export const getAllSprints = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const { page = 1, pageSize = 10, status } = req.query;
    const user = req.user;

    // Validate parameters
    const paramsValidation = validateParams(
      { organizationId, teamId, projectId },
      ['organizationId', 'teamId', 'projectId'],
    );

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: paramsValidation.message,
      });
    }

    // Validate pagination parameters
    const pageInt = parseInt(page, 10);
    const pageSizeInt = parseInt(pageSize, 10);

    if (
      isNaN(pageInt) ||
      isNaN(pageSizeInt) ||
      pageInt < 1 ||
      pageSizeInt < 1
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters',
      });
    }

    // Check if user has access to the project (all members can view sprints)
    const projectMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
        leftAt: null,
      },
    });

    if (!projectMember && user.role !== 'ADMIN') {
      const orgAccess = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: user.id,
          role: 'OWNER',
        },
      });

      if (!orgAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this project',
        });
      }
    }

    // Build where clause
    const where = {
      projectId,
      ...(status && { status }),
    };

    // Get total count of sprints (for pagination)
    const totalCount = await prisma.sprint.count({ where });

    // Get sprints with pagination and sorting
    const sprints = await prisma.sprint.findMany({
      where,
      skip: (pageInt - 1) * pageSizeInt,
      take: pageSizeInt,
      orderBy: {
        startDate: 'desc', // Sorting by start date (newest first)
      },
      include: {
        _count: {
          select: { tasks: true }, // Include task count
        },
      },
    });

    // Format response
    const formattedSprints = sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      description: sprint.description,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      goal: sprint.goal,
      taskCount: sprint._count.tasks,
      createdAt: sprint.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedSprints,
      pagination: {
        currentPage: pageInt,
        pageSize: pageSizeInt,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / pageSizeInt),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get a specific sprint with detailed information
 * @route  GET /api/organization/:organizationId/team/:teamId/project/:projectId/sprint/:sprintId
 * @method GET
 * @access private
 */
export const getSpecificSprint = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, sprintId } = req.params;
    const user = req.user;

    // Validate required parameters
    const paramsValidation = validateParams(
      { organizationId, teamId, projectId, sprintId },
      ['organizationId', 'teamId', 'projectId', 'sprintId'],
    );

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: paramsValidation.message,
      });
    }

    // Check if user has access to the project (all members can view)
    const isMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
        leftAt: null,
      },
    });

    const isAdminOrOwner =
      user.role === 'ADMIN' ||
      (await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: user.id,
          role: 'OWNER',
        },
      }));

    if (!isMember && !isAdminOrOwner) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this sprint',
      });
    }

    // Get the sprint with all related data
    const sprint = await prisma.sprint.findUnique({
      where: {
        id: sprintId,
        projectId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePic: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        activityLogs: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            activityLogs: true,
          },
        },
      },
    });

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found',
      });
    }

    // Calculate additional metrics
    const completedTasks = await prisma.task.count({
      where: {
        sprintId,
        status: 'DONE',
      },
    });

    const progress =
      sprint._count.tasks > 0
        ? Math.round((completedTasks / sprint._count.tasks) * 100)
        : 0;

    const daysRemaining = Math.ceil(
      (new Date(sprint.endDate) - new Date()) / (1000 * 60 * 60 * 24),
    );

    // Format the response
    const response = {
      success: true,
      data: {
        ...sprint,
        progress,
        daysRemaining,
        project: sprint.project,
        tasks: sprint.tasks.map((task) => ({
          ...task,
          assignee: task.assignee,
        })),
        recentActivity: sprint.activityLogs,
        stats: {
          totalTasks: sprint._count.tasks,
          completedTasks,
          activityCount: sprint._count.activityLogs,
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete a sprint (soft delete)
 * @route  DELETE /api/organization/:organizationId/team/:teamId/project/:projectId/sprint/:sprintId
 * @method DELETE
 * @access private
 */
export const deleteSprint = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId, sprintId } = req.params;
    const user = req.user;

    // Validate required parameters
    const paramsValidation = validateParams(
      { organizationId, teamId, projectId, sprintId },
      ['organizationId', 'teamId', 'projectId', 'sprintId'],
    );

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: paramsValidation.message,
      });
    }

    // Check project access and permissions
    const accessCheck = await checkProjectAccess(
      projectId,
      organizationId,
      teamId,
      user,
    );
    if (!accessCheck.success) {
      return res
        .status(accessCheck.message.includes('not found') ? 404 : 403)
        .json({
          success: false,
          message: accessCheck.message,
        });
    }

    // Only allow deletion by admins, org owners, team managers, or project owners
    if (!accessCheck.hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete sprints in this project',
      });
    }

    // Check if sprint exists and get current status
    const existingSprint = await prisma.sprint.findUnique({
      where: {
        id: sprintId,
        projectId,
      },
      include: {
        _count: {
          select: {
            tasks: {
              where: {
                status: {
                  not: 'DONE',
                },
              },
            },
          },
        },
      },
    });

    if (!existingSprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found',
      });
    }

    // Prevent deletion of active sprints with unfinished tasks
    if (existingSprint.status === 'ACTIVE' && existingSprint._count.tasks > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active sprint with unfinished tasks',
        unfinishedTasks: existingSprint._count.tasks,
      });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Remove sprint from all tasks
      await tx.task.updateMany({
        where: { sprintId },
        data: { sprintId: null },
      });

      // 2. Soft delete the sprint
      const deletedSprint = await tx.sprint.update({
        where: { id: sprintId },
        data: {
          deletedAt: new Date(),
          lastModifiedBy: user.id,
        },
        include: {
          project: {
            select: {
              name: true,
            },
          },
        },
      });

      return deletedSprint;
    });

    await createActivityLog({
      entityType: 'SPRINT',
      action: 'DELETED',
      userId: user.id,
      organizationId,
      teamId,
      projectId,
      sprintId: existingSprint.id,
      details: generateActivityDetails('DELETED', existingSprint, null),
    });

    res.status(200).json({
      success: true,
      message: 'Sprint deleted successfully',
      data: {
        id: result.id,
        name: result.name,
        deletedAt: result.deletedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
