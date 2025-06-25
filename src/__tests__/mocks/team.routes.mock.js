import express from 'express';
import { mockAuthMiddleware } from './middleware.mock.js';

const router = express.Router({ mergeParams: true });

// Mock team controller functions
export const mockTeamController = {
  createTeam: (req, res) => {
    const { name, description, members = [] } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: ['Team name is required'],
      });
    }

    if (name === 'Existing Team') {
      return res.status(409).json({
        success: false,
        message: 'Team with this name already exists',
      });
    }

    const teamId = 'mock-team-id-new';
    const leaderMember = {
      id: 'mock-team-member-id-1',
      teamId,
      userId: 'mock-user-id',
      role: 'LEADER',
      isActive: true,
    };

    const teamMembers = [
      {
        id: 'mock-team-member-id-1',
        userId: 'mock-user-id',
        role: 'LEADER',
        user: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          profilePic: null,
        },
      },
    ];

    // Add additional members if provided
    if (members && members.length > 0) {
      members.forEach((member, index) => {
        teamMembers.push({
          id: `mock-team-member-id-${index + 2}`,
          userId: member.userId || `mock-user-id-${index + 2}`,
          role: member.role || 'MEMBER',
          user: {
            id: member.userId || `mock-user-id-${index + 2}`,
            firstName: `Test${index + 2}`,
            lastName: `User${index + 2}`,
            email: `test${index + 2}@example.com`,
            profilePic: null,
          },
        });
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Team created successfully.',
      data: {
        team: {
          id: teamId,
          name,
          description,
        },
        teamLeader: {
          id: 'mock-user-id',
          leader: leaderMember,
        },
        teamMembers,
      },
    });
  },

  addTeamMember: (req, res) => {
    const { teamId } = req.params;
    const { members } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: ['Members array is required'],
      });
    }

    if (teamId !== 'mock-team-id-1' && teamId !== 'mock-team-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    const teamMembers = [
      {
        id: 'mock-team-member-id-1',
        userId: 'mock-user-id',
        role: 'LEADER',
        user: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          profilePic: null,
        },
      },
    ];

    // Add the new members
    members.forEach((member, index) => {
      teamMembers.push({
        id: `mock-team-member-id-${index + 2}`,
        userId: member.userId || `mock-user-id-${index + 2}`,
        role: member.role || 'MEMBER',
        user: {
          id: member.userId || `mock-user-id-${index + 2}`,
          firstName: `Test${index + 2}`,
          lastName: `User${index + 2}`,
          email: `test${index + 2}@example.com`,
          profilePic: null,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Members added successfully.',
      data: {
        team: {
          id: teamId,
          name: teamId === 'mock-team-id-1' ? 'Frontend Team' : 'Backend Team',
          description:
            teamId === 'mock-team-id-1'
              ? 'Frontend development team'
              : 'Backend development team',
        },
        teamLeader: {
          id: 'mock-user-id',
        },
        teamMembers,
      },
    });
  },

  removeTeamMember: (req, res) => {
    const { teamId, userId } = req.params;

    if (teamId !== 'mock-team-id-1' && teamId !== 'mock-team-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    if (userId === 'mock-user-id' && !req.query.allowLeaderRemoval) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot remove the only team leader. Please assign another leader first.',
      });
    }

    if (userId === 'not-found-user-id') {
      return res.status(404).json({
        success: false,
        message: 'Team member not found or already removed',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Team member Test User removed successfully',
      data: {
        removedMember: {
          id: 'mock-team-member-id-2',
          userId,
          name: 'Test User',
          removedAt: new Date().toISOString(),
        },
        team: {
          id: teamId,
          name: teamId === 'mock-team-id-1' ? 'Frontend Team' : 'Backend Team',
        },
      },
    });
  },

  updateTeam: (req, res) => {
    const { teamId } = req.params;
    const { name, description, avatar } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: ['Team name is required'],
      });
    }

    if (teamId !== 'mock-team-id-1' && teamId !== 'mock-team-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    if (name === 'Existing Team' && req.query.nameExists === 'true') {
      return res.status(409).json({
        success: false,
        message:
          'A team with the name "Existing Team" already exists in this organization',
      });
    }

    return res.status(200).json({
      success: true,
      team: {
        id: teamId,
        name,
        description,
        avatar: avatar || null,
        createdBy: 'mock-user-id',
        organizationId: req.params.organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  deleteTeam: (req, res) => {
    const { teamId } = req.params;

    if (teamId !== 'mock-team-id-1' && teamId !== 'mock-team-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Team not found or already deleted',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Team deleted successfully. 2 project(s) were also deleted.',
      data: {
        deletedTeamId: teamId,
        deletedTeamName:
          teamId === 'mock-team-id-1' ? 'Frontend Team' : 'Backend Team',
        deletedProjectsCount: 2,
        deletedProjects: [
          {
            id: 'mock-project-id-1',
            name: 'Project 1',
          },
          {
            id: 'mock-project-id-2',
            name: 'Project 2',
          },
        ],
      },
    });
  },

  getAllTeams: (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const teams = [
      {
        id: 'mock-team-id-1',
        name: 'Frontend Team',
        description: 'Frontend development team',
        avatar: null,
        createdBy: 'mock-user-id',
        organizationId: req.params.organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [
          {
            id: 'mock-team-member-id-1',
            userId: 'mock-user-id',
            role: 'LEADER',
            user: {
              id: 'mock-user-id',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
              profilePic: null,
            },
          },
        ],
        creator: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          profilePic: null,
        },
      },
      {
        id: 'mock-team-id-2',
        name: 'Backend Team',
        description: 'Backend development team',
        avatar: null,
        createdBy: 'mock-user-id',
        organizationId: req.params.organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [
          {
            id: 'mock-team-member-id-3',
            userId: 'mock-user-id',
            role: 'LEADER',
            user: {
              id: 'mock-user-id',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
              profilePic: null,
            },
          },
        ],
        creator: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          profilePic: null,
        },
      },
    ];

    // Filter teams if search is provided
    const filteredTeams = search
      ? teams.filter((team) =>
          team.name.toLowerCase().includes(search.toLowerCase()),
        )
      : teams;

    return res.status(200).json({
      success: true,
      data: {
        teams: filteredTeams,
        pagination: {
          page,
          limit,
          totalItems: filteredTeams.length,
          totalPages: Math.ceil(filteredTeams.length / limit),
        },
      },
    });
  },

  getSpecificTeam: (req, res) => {
    const { teamId } = req.params;

    if (teamId !== 'mock-team-id-1' && teamId !== 'mock-team-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    const isFirstTeam = teamId === 'mock-team-id-1';
    const teamName = isFirstTeam ? 'Frontend Team' : 'Backend Team';
    const teamDescription = isFirstTeam
      ? 'Frontend development team'
      : 'Backend development team';

    return res.status(200).json({
      success: true,
      data: {
        team: {
          id: teamId,
          name: teamName,
          description: teamDescription,
          avatar: null,
          createdBy: 'mock-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          creator: {
            id: 'mock-user-id',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            profilePic: null,
          },
          department: isFirstTeam
            ? {
                id: 'mock-dept-id-1',
                name: 'Engineering',
              }
            : null,
        },
        members: [
          {
            id: 'mock-team-member-id-1',
            teamId,
            userId: 'mock-user-id',
            user: {
              id: 'mock-user-id',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
              profilePic: null,
            },
          },
        ],
        projects: [
          {
            id: 'mock-project-id-1',
            name: 'Project 1',
            description: 'Project 1 description',
            status: 'IN_PROGRESS',
          },
          {
            id: 'mock-project-id-2',
            name: 'Project 2',
            description: 'Project 2 description',
            status: 'COMPLETED',
          },
        ],
        recentReports: [],
        statistics: {
          activeMembers: 1,
          totalProjects: 2,
          projectsInProgress: 1,
          completedProjects: 1,
        },
      },
    });
  },
};

// Apply mock controller to routes
router.use(mockAuthMiddleware);
router.get('/', mockTeamController.getAllTeams);
router.get('/:teamId', mockTeamController.getSpecificTeam);
router.post('/', mockTeamController.createTeam);
router.post('/:teamId/members', mockTeamController.addTeamMember);
router.delete('/:teamId/members/:userId', mockTeamController.removeTeamMember);
router.put('/:teamId', mockTeamController.updateTeam);
router.delete('/:teamId', mockTeamController.deleteTeam);

export default router;
