import prisma from '../config/prismaClient.js';
import {
  sprintvalidation,
  updateSprintValidation,
} from '../validations/sprint.validation.js';

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
        .status(accessCheck.message === 'Project not found' ? 404 : 403)
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
        .status(accessCheck.message === 'Project not found' ? 404 : 403)
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
        deletedAt: null,
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
      lastModifiedAt: new Date(),
    };

    if (name !== undefined) {
      // Check for name uniqueness if name is being updated
      if (name !== existingSprint.name) {
        const duplicateSprint = await prisma.sprint.findFirst({
          where: {
            projectId,
            name,
            id: { not: sprintId },
            deletedAt: null,
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
          deletedAt: null,
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
