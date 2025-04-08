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
 * @desc   Create a new team in a specific organization
 * @route  /api/organization/:organizationId/department/:departmentId/team
 * @method POST
 * @access private - admins or organization owners only
 */
export const createTeam = async (req, res, next) => {
  try {
    // POST /api/organization/:organizationId/department/:departmentId/team
    const { organizationId, departmentId } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
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

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Department ID is required',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
    });

    if (!existingDep) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check permissions - only admins and organization owners
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isDepManager = existingDep.managerId === req.user.id;

    if (!isAdmin && !isOwner && !isDepManager) {
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
          departmentId: departmentId,
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
    // POST /api/organization/:organizationId/department/:departmentId/team/:teamId/addMember
    const { organizationId, departmentId, teamId } = req.params;

    if (!organizationId || !departmentId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID, Department ID, and Team ID are required',
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
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

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
    });

    if (!existingDep) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if team exists and is not deleted
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdBy: true,
      },
    });
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // TODO: Extract all permission checks into a helper function like hasTeamAddPermission(user, org, dep, team) to simplify controller logic. and validate the these IDs
    // Check permissions - only admins and organization owners
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isDepManager = existingDep.managerId === req.user.id;
    const isTeamManager = team.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isDepManager && !isTeamManager) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to add members to this team in this department',
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

      // 2. fetch all team members for the response
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
    const { organizationId, departmentId, teamId, memberId } = req.params;

    if (!organizationId || !departmentId || !teamId || !memberId) {
      return res.status(400).json({
        success: false,
        message:
          'Organization ID, Department ID, Team ID, and Member ID are required',
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
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

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
    });

    if (!existingDep) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if team exists and is not deleted
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        departmentId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        createdBy: true,
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

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

    // Check permissions - admins, org owners, dep managers, or team creators can remove members
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isDepManager = existingDep.managerId === req.user.id;
    const isTeamCreator = team.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isDepManager && !isTeamCreator) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove members from this team',
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
    const { organizationId, departmentId, teamId } = req.params;

    if (!organizationId || !departmentId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID, Department ID, and Team ID are required',
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
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

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
      select: { managerId: true },
    });

    if (!existingDep) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if team exists and is not deleted
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdBy: true,
      },
    });
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // TODO: Extract all permission checks into a helper function like hasTeamAddPermission(user, org, dep, team) to simplify controller logic.
    // Check permissions - only admins and organization owners
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isDepManager = existingDep.managerId === req.user.id;
    const isTeamManager = team.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isDepManager && !isTeamManager) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to update this team in this department',
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

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: { name, description, avatar },
    });

    res.status(200).json({
      success: true,
      team: updatedTeam,
    });
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
    const { organizationId, departmentId, teamId } = req.params;

    if (!organizationId || !departmentId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID, Department ID, and Team ID are required',
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
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

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
      select: { managerId: true },
    });

    if (!existingDep) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if team exists and is not deleted
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdBy: true,
      },
    });
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // TODO: Extract all permission checks into a helper function like hasTeamAddPermission(user, org, dep, team) to simplify controller logic.
    // Check permissions - only admins and organization owners
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isDepManager = existingDep.managerId === req.user.id;
    const isTeamManager = team.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isDepManager && !isTeamManager) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to update this team in this department',
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
    const { organizationId, departmentId, teamId } = req.params;

    if (!organizationId || !departmentId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID, Department ID, and Team ID are required',
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
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

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
      select: { managerId: true },
    });

    if (!existingDep) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if team exists and is not deleted
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdBy: true,
      },
    });
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // TODO: Extract all permission checks into a helper function like hasTeamAddPermission(user, org, dep, team) to simplify controller logic.
    // Check permissions - only admins and organization owners
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isDepManager = existingDep.managerId === req.user.id;
    const isTeamManager = team.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isDepManager && !isTeamManager) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to update this team in this department',
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
    const { organizationId, departmentId, teamId } = req.params;

    if (!organizationId || !departmentId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID, Department ID, and Team ID are required',
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
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

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
      select: { managerId: true },
    });

    if (!existingDep) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if team exists and is not deleted
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdBy: true,
      },
    });
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found or already deleted',
      });
    }

    // TODO: Extract all permission checks into a helper function like hasTeamAddPermission(user, org, dep, team) to simplify controller logic.
    // Check permissions - only admins and organization owners
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isDepManager = existingDep.managerId === req.user.id;
    const isTeamManager = team.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isDepManager && !isTeamManager) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to delete this team in this department',
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
 * @route  /api/organization/:organizationId/department/:departmentId/team/all
 * @method GET
 * @access private - admins, organization owners, department managers
 */
export const getAllTeams = async (req, res, next) => {
  try {
    const { organizationId, departmentId } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;

    if (!organizationId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID and Department ID are required',
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
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

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
    });

    if (!existingDep) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check permissions
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isDepManager = existingDep.managerId === req.user.id;
    const isOrgMember = await prisma.organizationOwner.findFirst({
      where: {
        organizationId,
        userId: req.user.id,
      },
    });

    if (!isAdmin && !isOwner && !isDepManager && !isOrgMember) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view teams in this department',
      });
    }

    // pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search filter
    const searchFilter = search
      ? {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        }
      : {};

    const [teams, totalTeams] = await Promise.all([
      // Get teams
      prisma.team.findMany({
        where: {
          organizationId,
          departmentId,
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
        orderBy: {
          createdAt: 'desc',
        },
      }),

      // Count total teams
      prisma.team.count({
        where: {
          organizationId,
          departmentId,
          deletedAt: null,
          ...searchFilter,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        teams,
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
