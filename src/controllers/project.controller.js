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
 * departmentId - The department ID to check
 * returns - Contains success flag, error message, and department data
 */
const checkDepartment = async (departmentId) => {
  const dep = await prisma.department.findFirst({
    where: {
      id: departmentId,
      deletedAt: null,
    },
  });

  if (!dep) {
    return {
      success: false,
      message: 'Department not found',
    };
  }

  return {
    success: true,
    department: dep,
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
const checkTeamPermissions = (user, organization, department, team, action) => {
  const isAdmin = user.role === 'ADMIN';
  const isOwner = organization.owners.some((owner) => owner.userId === user.id);
  const isDepManager = department.managerId === user.id;
  const isTeamManager = team.createdBy === user.id;

  if (!isAdmin && !isOwner && !isDepManager && !isTeamManager) {
    return {
      success: false,
      message: `You do not have permission to ${action} this team`,
    };
  }

  return {
    success: true,
    isAdmin,
    isOwner,
    isDepManager,
    isTeamManager,
  };
};

/**
 * @desc   Create a new project
 * @route  /api/organization/:organizationId/department/:departmentId/team/:teamId/project
 * @method POST
 * @access private
 */
export const createProject = async (req, res, next) => {
  try {
    const { organizationId, departmentId, teamId } = req.params;

    // Validate required parameters
    const paramsValidation = validateParams(
      { organizationId, departmentId, teamId },
      ['organizationId', 'departmentId', 'teamId'],
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

    // Check if department exists
    const depResult = await checkDepartment(departmentId);
    if (!depResult.success) {
      return res.status(404).json({
        success: false,
        message: depResult.message,
      });
    }
    const existingDep = depResult.department;

    // Check if team exists
    const teamResult = await checkTeam(teamId, organizationId, departmentId);
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
      existingDep,
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

    // const {
    //   name,
    //   description,
    //   status = 'PLANNING',
    //   startDate,
    //   endDate,
    //   priority = 'MEDIUM',
    //   budget = null,
    //   members = [],
    // } = req.body;
  } catch (error) {
    next(error);
  }
};
