import prisma from '../config/prismaClient.js';
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from '../utils/cloudinary.utils.js';
import {
  addTeamMemberValidation,
  createTeamValidation,
  updateTeamValidation,
} from '../validations/team.validation.js';

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
 * @desc   Create a new team in a specific organization
 * @route  /api/organization/:organizationId/team
 * @method POST
 * @access private - admins or organization owners only
 */
export const createTeam = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    // Validate required parameters
    const paramsValidation = validateParams({ organizationId }, [
      'organizationId',
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

    // Check permissions - only admins and organization owners
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to create teams in this department',
      });
    }

    // Validate input
    const { error } = createTeamValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((e) => e.message),
      });
    }

    const { name, description, avatar, members = [] } = req.body;

    const existingTeam = await prisma.team.findFirst({
      where: {
        name: name,
        organizationId: organizationId,
        deletedAt: null,
      },
    });
    if (existingTeam) {
      return res.status(409).json({
        success: false,
        message: 'Team with this name already exists',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. create the team
      const team = await tx.team.create({
        data: {
          name,
          description,
          avatar,
          createdBy: req.user.id,
          organizationId: organizationId,
        },
      });

      // 2. create team member
      const leaderMember = await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: req.user.id,
          role: 'LEADER',
          isActive: true,
        },
      });

      // 3. create additional team members if provided
      const additionalMembers = [];
      if (members && members.length > 0) {
        for (const member of members) {
          // Check if user exists
          const userExists = await tx.user.findFirst({
            where: { id: member.userId, deletedAt: null },
            select: { id: true },
          });

          if (userExists) {
            const newMember = await tx.teamMember.create({
              data: {
                teamId: team.id,
                userId: member.userId,
                role: member.role || 'MEMBER',
                isActive: true,
              },
            });
            additionalMembers.push(newMember);
          }
        }
      }

      // 4. fetch all team members for the response
      const allTeamMembers = await tx.teamMember.findMany({
        where: { teamId: team.id },
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
      });

      return { team, leaderMember, allTeamMembers };
    });

    return res.status(201).json({
      success: true,
      message: `Team created successfully.`,
      data: {
        team: {
          id: result.team.id,
          name: result.team.name,
          description: result.team.description,
        },
        teamLeader: {
          id: result.team.createdBy,
          leader: result.leaderMember,
        },
        teamMembers: result.allTeamMembers.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          user: member.user,
        })),
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Team with this name already exists in this organization',
      });
    }
    next(error);
  }
};

/**
 * @desc   Add new team members
 * @route  /api/organization/:organizationId/department/:departmentId/team/:teamId/addMember
 * @method POST
 * @access private - admins or organization owners only
 */
export const addTeamMember = async (req, res, next) => {
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
      'add members to',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    // Validate input
    const { error } = addTeamMemberValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((e) => e.message),
      });
    }

    const { members } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const userIds = members.map((member) => member.userId);
      const existingUsers = await tx.user.findMany({
        where: {
          id: { in: userIds },
          deletedAt: null,
        },
        select: { id: true },
      });

      const existingUserIds = new Set(existingUsers.map((user) => user.id));

      // add members to a specific team
      const newMembers = [];
      for (const member of members) {
        if (existingUserIds.has(member.userId)) {
          try {
            const alreadyExists = await tx.teamMember.findFirst({
              where: {
                teamId,
                userId: member.userId,
              },
            });

            if (alreadyExists) {
              continue; // Skip this member silently
            }

            const newMember = await tx.teamMember.create({
              data: {
                teamId: teamId,
                userId: member.userId,
                role: member.role || 'MEMBER',
                isActive: true, // TODO: Implement OTP-based team membership verification endpoint
              },
            });
            newMembers.push(newMember);
          } catch (err) {
            // Handle unique constraint violation
            if (err.code === 'P2002') {
              continue;
            }
            throw err;
          }
        }
      }

      // Fetch all team members for the response
      const allTeamMembers = await tx.teamMember.findMany({
        where: { teamId: teamId },
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
      });

      return { newMembers, allTeamMembers };
    });

    return res.status(200).json({
      success: true,
      message: `Members added successfully.`,
      data: {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
        },
        teamLeader: {
          id: team.createdBy,
        },
        teamMembers: result.allTeamMembers.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          user: member.user,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Remove member from a team (soft delete)
 * @route  /api/organization/:organizationId/department/:departmentId/team/:teamId/members/:memberId
 * @method DELETE
 * @access private - admins, organization owners, department managers, or team creators
 */
export const removeTeamMember = async (req, res, next) => {
  try {
    const { organizationId, teamId, memberId } = req.params;

    // Validate required parameters
    const paramsValidation = validateParams(
      { organizationId, teamId, memberId },
      ['organizationId', 'teamId', 'memberId'],
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
    const teamResult = await checkTeam(teamId, organizationId, null);
    if (!teamResult.success) {
      return res.status(404).json({
        success: false,
        message: teamResult.message,
      });
    }
    const team = teamResult.team;

    // Check if team member exists
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found or already removed',
      });
    }

    // Check permissions
    const permissionCheck = checkTeamPermissions(
      req.user,
      existingOrg,
      team,
      'remove members from',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    // Prevent removing the team creator if they're the only leader
    if (teamMember.userId === team.createdBy) {
      // Check if there are other leaders in the team
      const otherLeaders = await prisma.teamMember.findMany({
        where: {
          teamId,
          role: 'LEADER',
          userId: { not: team.createdBy },
        },
      });

      if (otherLeaders.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'Cannot remove the only team leader. Please assign another leader first.',
        });
      }
    }

    // Soft delete the team member
    const removedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { deletedAt: new Date(), isActive: false },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Team member ${removedMember.user.firstName} ${removedMember.user.lastName} removed successfully`,
      data: {
        removedMember: {
          id: removedMember.id,
          userId: removedMember.userId,
          name: `${removedMember.user.firstName} ${removedMember.user.lastName}`,
          removedAt: removedMember.deletedAt,
        },
        team: {
          id: team.id,
          name: team.name,
        },
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }
    next(error);
  }
};

/**
 * @desc   Update a team
 * @route  /api/organization/:organizationId/department/:departmentId/team/:teamId
 * @method PUT
 * @access private - admins or organization owners only
 */
export const updateTeam = async (req, res, next) => {
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
      'update',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    // Validate input
    const { error } = updateTeamValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((e) => e.message),
      });
    }

    const { name, description, avatar } = req.body;

    // Check if team name already exists in this organization (if name is being updated)
    if (name && name !== team.name) {
      const existingTeamWithName = await prisma.team.findFirst({
        where: {
          organizationId,
          name,
          id: { not: teamId }, // Exclude current team
          deletedAt: null,
        },
      });

      if (existingTeamWithName) {
        return res.status(409).json({
          success: false,
          message: `A team with the name "${name}" already exists in this organization`,
        });
      }
    }

    // Proceed with update
    try {
      const updatedTeam = await prisma.team.update({
        where: { id: teamId },
        data: { name, description, avatar },
      });

      res.status(200).json({
        success: true,
        team: updatedTeam,
      });
    } catch (error) {
      // Handle unique constraint violation specifically
      if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
        return res.status(409).json({
          success: false,
          message: `A team with the name "${name}" already exists in this organization`,
        });
      }
      throw error; // Re-throw other errors to be caught by the outer catch
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Upload team avatar
 * @route  /api/organization/:organizationId/department/:departmentId/team/:teamId/avatar/upload
 * @method POST
 * @access private - admins or organization owners only
 */
export const uploadTeamAvatar = async (req, res, next) => {
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
      'update avatar for',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const avatar = await uploadToCloudinary(req.file.buffer, 'team_avatar');

    // Upload the team avatar
    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: { avatar },
    });

    res.status(200).json({
      success: true,
      message: 'Team avatar uploaded successfully',
      team: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete team avatar
 * @route  /api/organization/:organizationId/department/:departmentId/team/:teamId/avatar/delete
 * @method DELETE
 * @access private - admins or organization owners only
 */
export const deleteTeamAvatar = async (req, res, next) => {
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
      'delete avatar for',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    if (!team.avatar) {
      return res.status(404).json({ message: 'Team avatar not found' });
    }

    await deleteFromCloudinary(team.avatar);

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: { avatar: null },
    });

    res.status(200).json({
      message: 'Team avatar deleted successfully',
      team: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete team
 * @route  /api/organization/:organizationId/department/:departmentId/team/:teamId
 * @method DELETE
 * @access private - admins, organization owners, department managers, or team creators
 */
export const deleteTeam = async (req, res, next) => {
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
    const teamResult = await checkTeam(teamId, organizationId, null, {
      notFoundSuffix: ' or already deleted',
    });
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
      'delete',
    );

    if (!permissionCheck.success) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    // delete the team
    await prisma.team.update({
      where: { id: teamId },
      data: { deletedAt: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get all teams
 * @route  /api/organization/:organizationId/department/:departmentId/teams/all
 * @method GET
 * @access private - admins, organization owners, department managers
 */
export const getAllTeams = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;

    // Validate required parameters
    const validation = validateParams({ organizationId }, ['organizationId']);
    if (!validation.success) {
      return res
        .status(400)
        .json({ success: false, message: validation.message });
    }

    // Check if organization exists
    const orgCheck = await checkOrganization(organizationId);
    if (!orgCheck.success) {
      return res
        .status(404)
        .json({ success: false, message: orgCheck.message });
    }

    // Check permissions
    const permissionCheck = checkTeamPermissions(
      req.user,
      orgCheck.organization,
      { createdBy: null },
      'view',
    );
    if (!permissionCheck.success) {
      return res
        .status(403)
        .json({ success: false, message: permissionCheck.message });
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search filter
    const searchFilter = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    const [teams, totalTeams] = await Promise.all([
      // Get teams
      prisma.team.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...searchFilter,
        },
        include: {
          members: {
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
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePic: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),

      // Count total teams
      prisma.team.count({
        where: {
          organizationId,
          deletedAt: null,
          ...searchFilter,
        },
      }),
    ]);

    const teamsWithSafeCreator = teams.map((team) => ({
      ...team,
      creator: team.creator || {
        id: null,
        firstName: 'N/A',
        lastName: 'N/A',
        email: null,
        profilePic: null,
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        teams: teamsWithSafeCreator,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalItems: totalTeams,
          totalPages: Math.ceil(totalTeams / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get specific team details
 * @route  /api/organization/:organizationId/department/:departmentId/teams/:teamId
 * @method GET
 * @access private - admins, organization owners, department managers, team members
 */
export const getSpecificTeam = async (req, res, next) => {
  try {
    const { organizationId, teamId } = req.params;

    // Validate required parameters
    const validation = validateParams({ organizationId, teamId }, [
      'organizationId',
      'teamId',
    ]);
    if (!validation.success) {
      return res
        .status(400)
        .json({ success: false, message: validation.message });
    }

    // Check if organization exists
    const orgCheck = await checkOrganization(organizationId);
    if (!orgCheck.success) {
      return res
        .status(404)
        .json({ success: false, message: orgCheck.message });
    }

    // Check if team exists with additional fields needed for the view
    const teamCheck = await checkTeam(teamId, organizationId, null, {
      select: {
        members: {
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
        },
        projects: true,
        reports: true,
        department: true,
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePic: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!teamCheck.success) {
      return res
        .status(404)
        .json({ success: false, message: teamCheck.message });
    }

    // Check permissions
    const permissionCheck = checkTeamPermissions(
      req.user,
      orgCheck.organization,
      teamCheck.team,
      'view',
    );
    if (!permissionCheck.success) {
      return res
        .status(403)
        .json({ success: false, message: permissionCheck.message });
    }

    const { team } = teamCheck;

    // Calculate team statistics
    const activeMembers = team.members ? team.members.length : 0;
    const totalProjects = team.projects ? team.projects.length : 0;
    const projectsInProgress = team.projects
      ? team.projects.filter((project) => project.status === 'IN_PROGRESS')
          .length
      : 0;
    const completedProjects = team.projects
      ? team.projects.filter((project) => project.status === 'COMPLETED').length
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          avatar: team.avatar,
          createdBy: team.createdBy,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          creator: team.creator || {
            id: null,
            firstName: 'N/A',
            lastName: 'N/A',
            email: null,
            profilePic: null,
          },
          department: team.department,
        },
        members: team.members
          ? team.members.map((member) => ({
              id: member.id,
              role: member.role,
              user: member.user,
              joinedAt: member.joinedAt,
            }))
          : [],
        projects: team.projects || [],
        recentReports: team.reports || [],
        statistics: {
          activeMembers,
          totalProjects,
          projectsInProgress,
          completedProjects,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
