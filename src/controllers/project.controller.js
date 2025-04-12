import prisma from '../config/prismaClient.js';
import {
  createProjectValidation,
  updateProjectValidation,
} from '../validations/project.validation.js';

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
 * Helper function to check if department exists and is not deleted
 * @param {string} departmentId - The department ID to check
 * @returns {Promise<Object>} - Contains success flag, error message, and department data
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
 * @param {string} [departmentId] - Optional department ID the team belongs to
 * @param {Object} [options] - Additional options for the query
 * @returns {Promise<Object>} - Contains success flag, error message, and team data
 */
const checkTeamPermissions = (user, organization, team, action) => {
  const isAdmin = user.role === 'ADMIN';
  const isOwner = organization.owners.some((owner) => owner.userId === user.id);
  const isTeamManager = team.createdBy === user.id;

  if (!isAdmin && !isOwner && !isTeamManager) {
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
    const permissionCheck = checkTeamPermissions(
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
    const permissionCheck = checkTeamPermissions(
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
    const permissionCheck = checkTeamPermissions(
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
    const permissionCheck = checkTeamPermissions(
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
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId
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
    const permissionResult = checkTeamPermissions(
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
        updatedBy: user.id,
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
    const permissionResult = checkTeamPermissions(
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

    if (nonExistingUserIds.length > 0) {
      return res.status(404).json({
        message: 'Some users were not found',
        userIds: nonExistingUserIds,
      });
    }

    // Check which users are already members
    const existingMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        userId: {
          in: userIds,
        },
        leftAt: null, // Only consider active members
      },
      select: {
        userId: true,
      },
    });

    const existingMemberIds = existingMembers.map((member) => member.userId);
    const newMemberData = members.filter(
      (member) => !existingMemberIds.includes(member.userId),
    );

    if (newMemberData.length === 0) {
      return res
        .status(400)
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

    res.status(201).json({
      success: true,
      message: `Successfully added ${newMemberData.length} members to the project`,
      data: {
        count: projectMembers.count,
        skipped: userIds.length - newMemberData.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Remove project member
 * @route  /api/organization/:organizationId/team/:teamId/project/:projectId/removeMember
 * @method DELET
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
    const permissionResult = checkTeamPermissions(
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

    res.status(200).json({
      success: true,
      message: 'Member removed from project successfully',
    });
  } catch (error) {
    next(error);
  }
};
