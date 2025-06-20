import prisma from '../config/prismaClient.js';
import { ApiError } from '../utils/errorCodes.utils.js';

/**
 * @desc   Check if user can create chat for specific entity
 * @route  /api/permissions/chat/create
 * @method GET
 * @access private
 */
export const canCreateChat = async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    const userId = req.user.id;

    if (!entityType || !entityId) {
      return res.status(400).json({
        message: 'Entity type and entity ID are required',
      });
    }

    // Get user with their roles and relationships
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        managedDepartments: true,
        createdTeams: true,
        createdProjects: true,
        ownedOrganizations: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let canCreate = false;

    // Check based on user role
    if (['OWNER', 'MANAGER', 'ADMIN'].includes(user.role)) {
      canCreate = true;
    } else {
      // Check specific entity permissions
      switch (entityType) {
        case 'ORGANIZATION':
          // Check if user is organization owner
          const orgOwner = await prisma.organizationOwner.findUnique({
            where: {
              organizationId_userId: {
                organizationId: entityId,
                userId,
              },
            },
          });
          canCreate = !!orgOwner;
          break;

        case 'DEPARTMENT':
          // Check if user is department manager
          const deptManager = await prisma.department.findFirst({
            where: {
              id: entityId,
              managerId: userId,
            },
          });
          canCreate = !!deptManager;
          break;

        case 'TEAM':
          // Check if user is team creator or has LEADER role
          const teamMembership = await prisma.teamMember.findFirst({
            where: {
              teamId: entityId,
              userId,
              role: 'LEADER',
            },
          });
          const teamCreator = await prisma.team.findFirst({
            where: {
              id: entityId,
              createdBy: userId,
            },
          });
          canCreate = !!(teamMembership || teamCreator);
          break;

        case 'PROJECT':
          // Check if user is project creator
          const projectCreator = await prisma.project.findFirst({
            where: {
              id: entityId,
              createdBy: userId,
            },
          });
          canCreate = !!projectCreator;
          break;

        case 'TASK':
          // Check if user is task creator or assignee
          const taskPermission = await prisma.task.findFirst({
            where: {
              id: entityId,
              OR: [{ createdBy: userId }, { assignedTo: userId }],
            },
          });
          canCreate = !!taskPermission;
          break;

        default:
          canCreate = false;
      }
    }

    return res.status(200).json({ canCreate });
  } catch (error) {
    return res
      .status(500)
      .json(ApiError.serverError('Failed to check permission', error));
  }
};

/**
 * @desc   Get user's managed entities (departments, teams, projects)
 * @route  /api/permissions/managed-entities
 * @method GET
 * @access private
 */
export const getUserManagedEntities = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user with their roles and relationships
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        managedDepartments: true,
        createdTeams: true,
        createdProjects: true,
        ownedOrganizations: true,
        teamMemberships: {
          where: {
            role: 'LEADER',
          },
          include: {
            team: true,
          },
        },
        projectMemberships: {
          where: {
            role: {
              in: ['PROJECT_MANAGER', 'LEAD_DEVELOPER', 'PRODUCT_OWNER'],
            },
          },
          include: {
            project: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get managed departments
    const managedDepartments = await prisma.department.findMany({
      where: {
        managerId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    // Get teams where user is creator or leader
    const managedTeams = await prisma.team.findMany({
      where: {
        OR: [
          { createdBy: userId },
          {
            members: {
              some: {
                userId,
                role: 'LEADER',
              },
            },
          },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    // Get projects where user is creator or has leadership role
    const managedProjects = await prisma.project.findMany({
      where: {
        OR: [
          { createdBy: userId },
          {
            ProjectMember: {
              some: {
                userId,
                role: {
                  in: ['PROJECT_MANAGER', 'LEAD_DEVELOPER', 'PRODUCT_OWNER'],
                },
              },
            },
          },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return res.status(200).json({
      departments: managedDepartments,
      teams: managedTeams,
      projects: managedProjects,
    });
  } catch (error) {
    return res
      .status(500)
      .json(ApiError.serverError('Failed to fetch managed entities', error));
  }
};
