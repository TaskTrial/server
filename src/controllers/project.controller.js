import prisma from '../config/prismaClient.js';
import { createProjectValidation } from '../validations/project.validation.js';

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
