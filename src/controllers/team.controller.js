import prisma from '../config/prismaClient.js';
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
              name: true,
              email: true,
              avatar: true,
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
              name: true,
              email: true,
              avatar: true,
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
