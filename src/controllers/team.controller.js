import prisma from '../config/prismaClient.js';
import { createTeamValidation } from '../validations/team.validation.js';

/**
 * @desc   Create a new team in a specific organization
 * @route  /api/organization
 * @method POST
 * @access private - admins or organization owners only
 */
export const createTeam = async (req, res, next) => {
  try {
    // POST /api/organization/:organizationId/department/:departmentId/team
    const { organizationId, departmendId } = req.params;

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

    if (!departmendId) {
      return res.status(400).json({
        success: false,
        message: 'Department ID is required',
      });
    }

    // Check if department exists and is not deleted
    const existingDep = await prisma.department.findFirst({
      where: {
        id: departmendId,
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

    const existingteam = await prisma.team.findFirst({
      where: {
        name: name,
        organizationId: organizationId,
        deletedAt: null,
      },
    });
    if (existingteam) {
      return res.status(409).json({
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
          departmentId: departmendId,
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
          const userExists = await tx.user.findUnique({
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
