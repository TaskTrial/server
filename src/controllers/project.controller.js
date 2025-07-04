import prisma from '../config/prismaClient.js';
import {
  createProjectValidation,
  updateProjectValidation,
} from '../validations/project.validation.js';
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
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePic: true,
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
const checkTeam = async (
  teamId,
  organizationId,
  departmentId = null,
  options = {},
) => {
  const whereClause = {
    id: teamId,
    organizationId,
    deletedAt: null,
  };

  if (departmentId) {
    whereClause.departmentId = departmentId;
  }

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
 * Helper function to check if team exists and is not deleted
 * @param {string} teamId - The team ID to check
 * @param {string} organizationId - The organization ID the team belongs to
 * @param {Object} [options] - Additional options for the query
 * @returns {Promise<Object>} - Contains success flag, error message, and team data
 */
const checkTeamPermissions = async (user, organization, team, action) => {
  const isAdmin = user.role === 'ADMIN';
  const isOwner = organization.owners.some((owner) => owner.userId === user.id);
  const isTeamManager = team.createdBy === user.id;

  // Check if user is a team leader
  let isTeamLeader = false;
  if (team.id) {
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        userId: user.id,
        role: 'LEADER',
        deletedAt: null,
      },
    });
    isTeamLeader = !!teamMember;
  }

  if (!isAdmin && !isOwner && !isTeamManager && !isTeamLeader) {
    return {
      success: false,
      message: `You do not have permission to ${action} this team`,
    };
  }

  return {
    success: true,
    isAdmin,
    isOwner,
    isTeamManager,
    isTeamLeader,
  };
};

/**
 * @desc   Create a new project
 * @route  /api/organization/:organizationId/team/:teamId/project
 * @method POST
 * @access private
 */
export const createProject = async (req, res, next) => {
  try {
    const { organizationId, teamId } = req.params;

    // Validate required parameters
    const paramsValidation = validateParams({ organizationId, teamId }, [
      'organizationId',
      'teamId',
    ]);

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: paramsValidation.message,
      });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const existingOrg = orgResult.organization;

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({
        success: false,
        message: teamResult.message,
      });
    }
    const team = teamResult.team;

    // Check permissions
    const permissionCheck = await checkTeamPermissions(
      req.user,
      existingOrg,
      team,
      'create a project in',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    // Validate input
    const { error } = createProjectValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((e) => e.message),
      });
    }

    const {
      name,
      description,
      status = 'PLANNING',
      startDate,
      endDate,
      priority = 'MEDIUM',
      budget = null,
      members = [],
    } = req.body;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. create project
        const project = await tx.project.create({
          data: {
            name,
            description,
            status,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            priority,
            budget,
            teamId,
            organizationId,
            lastModifiedBy: req.user.id,
            createdBy: req.user.id,
            progress: 0,
          },
        });

        // 2. create project leader
        const projectLeader = await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: req.user.id,
            role: 'PROJECT_OWNER',
            isActive: true,
          },
        });

        // 3. Create project members if any
        const projectMembers = [];
        if (members.length > 0) {
          for (const member of members) {
            const createMember = await tx.projectMember.create({
              data: {
                projectId: project.id,
                userId: member.userId,
                role: member.role || 'MEMBER',
                isActive: true,
              },
            });
            projectMembers.push(createMember);
          }
        }

        return { project, projectLeader, projectMembers };
      });

      await createActivityLog({
        entityType: 'PROJECT',
        action: 'CREATED',
        userId: req.user.id,
        organizationId,
        teamId,
        projectId: result.project.id,
        details: generateActivityDetails('CREATED', null, {
          projectId: result.project.id,
          name: result.project.name,
          description: result.project.description,
          startDate: result.project.startDate,
          endDate: result.project.endDate,
          status: result.project.status,
          priority: result.project.priority,
        }),
      });

      res.status(201).json({
        success: true,
        message: 'Project created successfully.',
        data: {
          project: result.project,
          projectOwner: result.projectLeader,
          members: result.projectMembers,
        },
      });
    } catch (error) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message:
            'A project with this name already exists in this organization',
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update a project
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId
 * @method PUT
 * @access private
 */
export const updateProject = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;

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

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const existingOrg = orgResult.organization;

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({
        success: false,
        message: teamResult.message,
      });
    }
    const team = teamResult.team;

    // Check if project exists
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        teamId: teamId,
        organizationId: organizationId,
        deletedAt: null,
      },
    });

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Check permissions (can be done via a similar helper function as in create)
    const permissionCheck = await checkTeamPermissions(
      req.user,
      existingOrg,
      team,
      'update',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    // Additional project-specific permissions check if needed
    const isProjectOwner = await prisma.projectMember.findFirst({
      where: {
        projectId: projectId,
        userId: req.user.id,
        role: 'PROJECT_OWNER',
        isActive: true,
      },
    });

    const hasPermission =
      permissionCheck.isAdmin ||
      permissionCheck.isOwner ||
      permissionCheck.isTeamManager ||
      permissionCheck.isTeamLeader ||
      isProjectOwner;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this project',
      });
    }

    // Validate input
    const { error } = updateProjectValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((e) => e.message),
      });
    }

    const {
      name,
      description,
      status,
      startDate,
      endDate,
      priority,
      budget,
      progress,
    } = req.body;

    // Check date validation if both dates are provided
    if (startDate && endDate) {
      const normalizedStartDate = new Date(startDate);
      normalizedStartDate.setHours(0, 0, 0, 0);

      const normalizedEndDate = new Date(endDate);
      normalizedEndDate.setHours(0, 0, 0, 0);

      if (normalizedStartDate >= normalizedEndDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date',
        });
      }
    }

    try {
      // Construct update data with only the fields that were provided
      const updateData = {};

      if (name !== undefined) {
        updateData.name = name;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
      if (status !== undefined) {
        updateData.status = status;
      }
      if (priority !== undefined) {
        updateData.priority = priority;
      }
      if (budget !== undefined) {
        updateData.budget = budget;
      }
      if (progress !== undefined) {
        updateData.progress = progress;
      }
      if (startDate !== undefined) {
        updateData.startDate = new Date(startDate);
      }
      if (endDate !== undefined) {
        updateData.endDate = new Date(endDate);
      }

      // Always update lastModifiedBy
      updateData.lastModifiedBy = req.user.id;

      // Check for name uniqueness if name is being updated
      if (name && name !== existingProject.name) {
        const duplicateProject = await prisma.project.findFirst({
          where: {
            organizationId,
            name,
            id: { not: projectId },
            deletedAt: null,
          },
        });

        if (duplicateProject) {
          return res.status(400).json({
            success: false,
            message:
              'A project with this name already exists in this organization',
          });
        }
      }

      // Update the project
      const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: updateData,
      });

      await createActivityLog({
        entityType: 'PROJECT',
        action: 'UPDATED',
        userId: req.user.id,
        organizationId,
        teamId,
        projectId: updatedProject.id,
        details: generateActivityDetails(
          'UPDATED',
          existingProject,
          updatedProject,
        ),
      });

      res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data: updatedProject,
      });
    } catch (error) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message:
            'A project with this name already exists in this organization',
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update project status
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/status
 * @method PATCH
 * @access private
 */
export const updateProjectStatus = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const { status } = req.body;

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

    // Validate status
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    // Validate status value
    const validStatuses = [
      'PLANNING',
      'ACTIVE',
      'ON_HOLD',
      'COMPLETED',
      'CANCELED',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const existingOrg = orgResult.organization;

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({
        success: false,
        message: teamResult.message,
      });
    }
    const team = teamResult.team;

    // Check if project exists
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        teamId: teamId,
        organizationId: organizationId,
        deletedAt: null,
      },
    });

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Check permissions
    const permissionCheck = await checkTeamPermissions(
      req.user,
      existingOrg,
      team,
      'update status of',
    );

    // Check if user is a project member with appropriate rights
    const projectMembership = await prisma.projectMember.findFirst({
      where: {
        projectId: projectId,
        userId: req.user.id,
        isActive: true,
        role: {
          in: ['PROJECT_OWNER', 'PROJECT_MANAGER'],
        },
      },
    });

    const hasPermission = permissionCheck.success || projectMembership !== null;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this project's status",
      });
    }

    // If status is the same, no need to update
    if (existingProject.status === status) {
      return res.status(200).json({
        success: true,
        message: 'Project status remains unchanged',
        data: existingProject,
      });
    }

    // Update the project status
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status,
        lastModifiedBy: req.user.id,
      },
    });

    await createActivityLog({
      entityType: 'PROJECT',
      action: 'STATUS_CHANGED',
      userId: req.user.id,
      organizationId,
      teamId,
      projectId: updatedProject.id,
      details: {
        oldStatus: existingProject.status,
        newStatus: updatedProject.status,
        updatedAt: updatedProject.updatedAt,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Project status updated successfully',
      data: updatedProject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update project priority
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/priority
 * @method PATCH
 * @access private
 */
export const updateProjectPriority = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const { priority } = req.body;

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

    // Validate priority
    if (!priority) {
      return res.status(400).json({
        success: false,
        message: 'Priority is required',
      });
    }

    // Validate priority value
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Priority must be one of: ${validPriorities.join(', ')}`,
      });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({
        success: false,
        message: orgResult.message,
      });
    }
    const existingOrg = orgResult.organization;

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({
        success: false,
        message: teamResult.message,
      });
    }
    const team = teamResult.team;

    // Check if project exists
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        teamId: teamId,
        organizationId: organizationId,
        deletedAt: null,
      },
    });

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Check permissions
    const permissionCheck = await checkTeamPermissions(
      req.user,
      existingOrg,
      team,
      'update priority of',
    );

    // Check if user is a project member with appropriate rights
    const projectMembership = await prisma.projectMember.findFirst({
      where: {
        projectId: projectId,
        userId: req.user.id,
        isActive: true,
        role: {
          in: ['PROJECT_OWNER', 'PROJECT_MANAGER'],
        },
      },
    });

    const hasPermission = permissionCheck.success || projectMembership !== null;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this project's priority",
      });
    }

    // If priority is the same, no need to update
    if (existingProject.priority === priority) {
      return res.status(200).json({
        success: true,
        message: 'Project priority remains unchanged',
        data: existingProject,
      });
    }

    // Update the project priority
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        priority,
        lastModifiedBy: req.user.id,
      },
    });

    await createActivityLog({
      entityType: 'PROJECT',
      action: 'UPDATED',
      userId: req.user.id,
      organizationId,
      teamId,
      projectId: updatedProject.id,
      details: {
        field: 'priority',
        oldPriority: existingProject.priority,
        newPriority: updatedProject.priority,
        updatedAt: updatedProject.updatedAt,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Project priority updated successfully',
      data: updatedProject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete a project
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/delete
 * @method DELETE
 * @access private
 */
export const deleteProject = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const user = req.user;

    // Validate required parameters
    const validationResult = validateParams(
      { organizationId, teamId, projectId },
      ['organizationId', 'teamId', 'projectId'],
    );

    if (!validationResult.success) {
      return res.status(400).json({ message: validationResult.message });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({ message: orgResult.message });
    }

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({ message: teamResult.message });
    }

    // Check if project exists
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        teamId,
        deletedAt: null,
      },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check user permissions
    const permissionResult = await checkTeamPermissions(
      user,
      orgResult.organization,
      teamResult.team,
      'delete projects from',
    );
    if (!permissionResult.success) {
      return res.status(403).json({ message: permissionResult.message });
    }

    // Soft delete the project
    await prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        deletedAt: new Date(),
        lastModifiedBy: user.id,
      },
    });

    await createActivityLog({
      entityType: 'PROJECT',
      action: 'DELETED',
      userId: user.id,
      organizationId,
      teamId,
      projectId: project.id,
      details: {
        projectName: project.name,
        deletedAt: new Date(),
        projectData: project,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Restore a project
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/restore
 * @method PATCH
 * @access private
 */
export const restoreProject = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const user = req.user;

    // Validate required parameters
    const validationResult = validateParams(
      { organizationId, teamId, projectId },
      ['organizationId', 'teamId', 'projectId'],
    );

    if (!validationResult.success) {
      return res.status(400).json({ message: validationResult.message });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({ message: orgResult.message });
    }

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({ message: teamResult.message });
    }

    // Check if project exists
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        teamId,
      },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check user permissions
    const permissionResult = await checkTeamPermissions(
      user,
      orgResult.organization,
      teamResult.team,
      'restore projects from',
    );
    if (!permissionResult.success) {
      return res.status(403).json({ message: permissionResult.message });
    }

    // restore the project
    await prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        deletedAt: null,
        lastModifiedBy: user.id,
      },
    });

    await createActivityLog({
      entityType: 'PROJECT',
      action: 'RESTORED',
      userId: user.id,
      organizationId,
      teamId,
      projectId: project.id,
      details: {
        projectName: project.name,
        restoredAt: new Date(),
        previouslyDeletedAt: project.deletedAt,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Project restored successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Add project members
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/addMember
 * @method POST
 * @access private
 */
export const addProjectMember = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const { members } = req.body; // Array of { userId, role }

    // Validate required parameters
    const validationResult = validateParams(
      { organizationId, teamId, projectId, members },
      ['organizationId', 'teamId', 'projectId', 'members'],
    );

    if (!validationResult.success) {
      return res.status(400).json({ message: validationResult.message });
    }

    // Check if members is an array
    if (!Array.isArray(members) || members.length === 0) {
      return res
        .status(400)
        .json({ message: 'Members should be a non-empty array' });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({ message: orgResult.message });
    }

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({ message: teamResult.message });
    }

    // Check if project exists
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        teamId,
        deletedAt: null,
      },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check user permissions
    const permissionResult = await checkTeamPermissions(
      req.user,
      orgResult.organization,
      teamResult.team,
      'add members to',
    );
    if (!permissionResult.success) {
      return res.status(403).json({ message: permissionResult.message });
    }

    // Extract all userIds to validate them
    const userIds = members.map((member) => member.userId);

    // Check if all users exist
    const existingUsers = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
      },
    });

    const existingUserIds = existingUsers.map((user) => user.id);
    const nonExistingUserIds = userIds.filter(
      (id) => !existingUserIds.includes(id),
    );

    // Filter our member data to only include existing users
    const validMemberData = members.filter((member) =>
      existingUserIds.includes(member.userId),
    );

    // If none of the users exist, return an error
    if (validMemberData.length === 0) {
      return res.status(404).json({
        message: 'None of the specified users were found',
        userIds: nonExistingUserIds,
      });
    }

    // Continue with only valid/existing users
    // Check which users are already members
    const existingMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        userId: {
          in: existingUserIds, // Use only existing user IDs
        },
        leftAt: null,
      },
      select: {
        userId: true,
      },
    });

    const existingMemberIds = existingMembers.map((member) => member.userId);
    const newMemberData = validMemberData.filter(
      (member) => !existingMemberIds.includes(member.userId),
    );

    if (newMemberData.length === 0) {
      return res
        .status(200)
        .json({ message: 'All users are already members of this project' });
    }

    // Add the new members to the project
    const projectMembers = await prisma.projectMember.createMany({
      data: newMemberData.map((member) => ({
        projectId,
        userId: member.userId,
        role: member.role || 'MEMBER', // Default role if not specified
        joinedAt: new Date(),
        isActive: true,
      })),
    });

    await createActivityLog({
      entityType: 'PROJECT',
      action: 'MEMBER_ADDED',
      userId: req.user.id,
      organizationId,
      teamId,
      projectId,
      details: {
        projectMembers,
        addedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: `Successfully added ${newMemberData.length} members to the project`,
      data: {
        count: projectMembers.count,
        skipped: {
          alreadyMembers:
            userIds.length - newMemberData.length - nonExistingUserIds.length,
          nonExistingUsers: nonExistingUserIds.length,
          nonExistingUserIds: nonExistingUserIds,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Remove project member
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/removeMember
 * @method DELETE
 * @access private
 */
export const removeProjectMember = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const { userId } = req.body;
    const user = req.user;

    // Validate required parameters
    const validationResult = validateParams(
      { organizationId, teamId, projectId, userId },
      ['organizationId', 'teamId', 'projectId', 'userId'],
    );

    if (!validationResult.success) {
      return res.status(400).json({ message: validationResult.message });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({ message: orgResult.message });
    }

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({ message: teamResult.message });
    }

    // Check if project exists
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        teamId,
        deletedAt: null,
      },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check user permissions
    const permissionResult = await checkTeamPermissions(
      user,
      orgResult.organization,
      teamResult.team,
      'remove members from',
    );
    if (!permissionResult.success) {
      return res.status(403).json({ message: permissionResult.message });
    }

    // Check if the member exists in the project
    const memberToRemove = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        deletedAt: null,
      },
    });

    if (!memberToRemove) {
      return res
        .status(404)
        .json({ message: 'User is not a member of this project' });
    }

    // Soft delete the project member
    await prisma.projectMember.update({
      where: {
        id: memberToRemove.id,
      },
      data: {
        deletedAt: new Date(),
        leftAt: new Date(),
        isActive: false,
      },
    });

    await createActivityLog({
      entityType: 'PROJECT',
      action: 'MEMBER_REMOVED',
      userId: user.id,
      organizationId,
      teamId,
      projectId,
      details: {
        removedUserId: memberToRemove.id,
        previousRole: memberToRemove.role,
        removedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Member removed from project successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all projects
 * @route  /api/organization/:organizationId/team/:teamId/project/all
 * @method GET
 * @access private
 */
export const getAllProjects = async (req, res, next) => {
  try {
    const { organizationId, teamId } = req.params;
    const user = req.user;

    // Validate required parameters
    const validationResult = validateParams({ organizationId, teamId }, [
      'organizationId',
      'teamId',
    ]);

    if (!validationResult.success) {
      return res.status(400).json({ message: validationResult.message });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({ message: orgResult.message });
    }
    const organization = orgResult.organization;

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({ message: teamResult.message });
    }

    // Determine if the user has special permissions for this team
    const permissionResult = await checkTeamPermissions(
      user,
      orgResult.organization,
      teamResult.team,
      'view projects in',
    );
    const isOrgMember = organization.users.some(
      (user) => user.id === req.user.id,
    );

    // Define base query conditions
    const whereConditions = {
      teamId,
      deletedAt: null,
    };

    // If user is not admin, owner, or team manager, only show projects they are a member of
    if (!permissionResult.success && !isOrgMember) {
      // Get all projects where user is a member
      const projects = await prisma.project.findMany({
        where: whereConditions,
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
          _count: {
            select: {
              ProjectMember: {
                where: {
                  leftAt: null,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Filter to only include projects where user is a member
      const filteredProjects = projects.filter(
        (project) => project.ProjectMember.length > 0,
      );

      return res.status(200).json({
        success: true,
        data: filteredProjects.map((project) => ({
          ...project,
          memberCount: project._count.ProjectMember,
          userRole: project.members[0]?.role || null,
          ProjectMember: undefined,
          _count: undefined,
        })),
      });
    } else {
      // For users with team permissions, show all projects
      const projects = await prisma.project.findMany({
        where: whereConditions,
        include: {
          _count: {
            select: {
              ProjectMember: {
                where: {
                  leftAt: null,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.status(200).json({
        success: true,
        data: projects.map((project) => ({
          ...project,
          memberCount: project._count.ProjectMember,
          _count: undefined,
        })),
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get a specific project
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId
 * @method GET
 * @access private
 */
export const getSpecificProject = async (req, res, next) => {
  try {
    const { organizationId, teamId, projectId } = req.params;
    const user = req.user;

    // Validate required parameters
    const validationResult = validateParams(
      { organizationId, teamId, projectId },
      ['organizationId', 'teamId', 'projectId'],
    );

    if (!validationResult.success) {
      return res.status(400).json({ message: validationResult.message });
    }

    // Check if organization exists
    const orgResult = await checkOrganization(organizationId);
    if (!orgResult.success) {
      return res.status(404).json({ message: orgResult.message });
    }
    const organization = orgResult.organization;

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId);
    if (!teamResult.success) {
      return res.status(404).json({ message: teamResult.message });
    }

    // Check if project exists
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        teamId,
        deletedAt: null,
      },
      include: {
        ProjectMember: {
          where: {
            leftAt: null,
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
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
        tasks: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is a project member or has team permissions
    const isMember = project.ProjectMember.some(
      (member) => member.userId === user.id,
    );
    const permissionResult = await checkTeamPermissions(
      user,
      orgResult.organization,
      teamResult.team,
      'view',
    );
    const isOrgMember = organization.users.some(
      (user) => user.id === req.user.id,
    );

    if (!isMember && !permissionResult.success && !isOrgMember) {
      return res
        .status(403)
        .json({ message: 'You do not have permission to view this project' });
    }

    // Format the response data
    const formattedProject = {
      ...project,
      members: project.ProjectMember.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        isActive: member.isActive,
        user: member.user,
      })),
      memberCount: project.ProjectMember.length,
      taskCount: project.tasks.length,
      userRole:
        project.ProjectMember.find((member) => member.userId === user.id)
          ?.role || null,
    };

    res.status(200).json({
      success: true,
      data: formattedProject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get projects in a specific organization
 * @route  /api/organization/:organizationId/projects
 * @method GET
 * @access private
 */
export const getProjectsInSpecificOrg = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const {
      teamId,
      teamName,
      status,
      page = 1,
      limit = 10,
      includeTasks = 'true',
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
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

    // Build the where clause for projects query
    const whereClause = {
      organizationId,
    };

    // Add team filter if teamId or teamName is provided
    if (teamId || teamName) {
      // Find the team
      const teamWhereClause = {
        organizationId,
        deletedAt: null,
      };

      if (teamId) {
        teamWhereClause.id = teamId;
      } else if (teamName) {
        teamWhereClause.name = {
          contains: teamName,
          mode: 'insensitive',
        };
      }

      const team = await prisma.team.findFirst({
        where: teamWhereClause,
        select: {
          id: true,
        },
      });

      if (!team) {
        return res.status(404).json({
          success: false,
          message: teamId
            ? 'Team not found'
            : 'No team matching the provided name',
        });
      }

      whereClause.teamId = team.id;
    }

    // Add status filter if provided
    if (status) {
      whereClause.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build the include object for the projects query
    const includeObj = {
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      ProjectMember: {
        where: {
          leftAt: null,
        },
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
        },
        take: 5,
      },
      _count: {
        select: {
          tasks: {
            where: {
              deletedAt: null,
            },
          },
          ProjectMember: {
            where: {
              leftAt: null,
            },
          },
        },
      },
    };

    // Include tasks if requested
    if (includeTasks === 'true') {
      includeObj.tasks = {
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
          createdAt: true,
          updatedAt: true,
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
              subtasks: true,
              comments: true,
              attachments: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: 10, // Limit to 10 tasks per project
      };
    }

    // Get active projects (not deleted)
    const activeProjects = await prisma.project.findMany({
      where: {
        ...whereClause,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        priority: true,
        progress: true,
        budget: true,
        ...includeObj,
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      skip,
      take: parseInt(limit),
    });

    // Count total active projects for pagination
    const totalActiveProjects = await prisma.project.count({
      where: {
        ...whereClause,
        deletedAt: null,
      },
    });

    // Get archived/deleted projects (if admin or owner)
    let archivedProjects = [];
    let totalArchivedProjects = 0;

    if (
      req.user.role === 'ADMIN' ||
      organization.owners.some((owner) => owner.user.id === req.user.id)
    ) {
      archivedProjects = await prisma.project.findMany({
        where: {
          ...whereClause,
          deletedAt: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          startDate: true,
          endDate: true,
          deletedAt: true,
          priority: true,
          progress: true,
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              tasks: true,
              ProjectMember: true,
            },
          },
        },
        orderBy: {
          deletedAt: 'desc',
        },
        take: 5,
      });

      totalArchivedProjects = await prisma.project.count({
        where: {
          ...whereClause,
          deletedAt: {
            not: null,
          },
        },
      });
    }

    // Format active projects
    const formattedActiveProjects = activeProjects.map((project) => {
      // Check if user is a member of this project
      const userMembership = project.ProjectMember.find(
        (member) => member.userId === req.user.id,
      );

      // Calculate task statistics
      const taskStats = {
        total: project._count.tasks,
        notStarted: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
      };

      let formattedTasks = [];

      if (includeTasks === 'true' && project.tasks) {
        // Count tasks by status
        project.tasks.forEach((task) => {
          if (task.status === 'NOT_STARTED') {
            taskStats.notStarted++;
          } else if (task.status === 'IN_PROGRESS') {
            taskStats.inProgress++;
          } else if (task.status === 'COMPLETED') {
            taskStats.completed++;
          }

          // Check for overdue tasks
          if (task.dueDate < new Date() && task.status !== 'COMPLETED') {
            taskStats.overdue++;
          }
        });

        // Format tasks
        formattedTasks = project.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate,
          estimatedTime: task.estimatedTime,
          actualTime: task.actualTime,
          labels: task.labels,
          subtaskCount: task._count.subtasks,
          commentCount: task._count.comments,
          attachmentCount: task._count.attachments,
          assignee: task.assignee
            ? {
                id: task.assignee.id,
                firstName: task.assignee.firstName,
                lastName: task.assignee.lastName,
                profilePic: task.assignee.profilePic,
              }
            : null,
          isOverdue: task.dueDate < new Date() && task.status !== 'COMPLETED',
        }));
      }

      // Calculate completion percentage
      const completionPercentage =
        taskStats.total > 0
          ? Math.round((taskStats.completed / taskStats.total) * 100)
          : 0;

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        priority: project.priority,
        progress: project.progress || completionPercentage, // Use calculated percentage if progress is not set
        budget: project.budget,
        team: project.team,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        memberCount: project._count.ProjectMember,
        members: project.ProjectMember.map((member) => ({
          userId: member.userId,
          role: member.role,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          profilePic: member.user.profilePic,
        })),
        hasMoreMembers: project._count.ProjectMember > 5,
        userRole: userMembership?.role || null,
        taskStats,
        tasks: includeTasks === 'true' ? formattedTasks : undefined,
        hasMoreTasks: project._count.tasks > (formattedTasks?.length || 0),
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalActiveProjects / parseInt(limit));

    // Format and return response
    return res.status(200).json({
      success: true,
      message: `Organization's projects retrieved successfully`,
      data: {
        activeProjects: formattedActiveProjects,
        archivedProjects: archivedProjects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          startDate: project.startDate,
          endDate: project.endDate,
          deletedAt: project.deletedAt,
          priority: project.priority,
          progress: project.progress,
          team: project.team,
          taskCount: project._count.tasks,
          memberCount: project._count.ProjectMember,
        })),
        statistics: {
          totalActiveProjects,
          totalArchivedProjects,
          totalProjects: totalActiveProjects + totalArchivedProjects,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages,
          totalItems: totalActiveProjects,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
