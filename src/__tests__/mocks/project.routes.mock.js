import express from 'express';
import { mockAuthMiddleware } from './middleware.mock.js';

const router = express.Router({ mergeParams: true });

// Mock project controller functions
export const mockProjectController = {
  createProject: (req, res) => {
    const {
      name,
      description,
      status,
      startDate,
      endDate,
      priority,
      budget,
      members = [],
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: ['Project name is required'],
      });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
      });
    }

    if (name === 'Existing Project') {
      return res.status(400).json({
        success: false,
        message: 'A project with this name already exists in this organization',
      });
    }

    const projectId = 'mock-project-id-new';
    const projectLeader = {
      id: 'mock-project-member-id-1',
      projectId,
      userId: 'mock-user-id',
      role: 'PROJECT_OWNER',
      isActive: true,
    };

    const projectMembers = [];
    if (members && members.length > 0) {
      members.forEach((member, index) => {
        projectMembers.push({
          id: `mock-project-member-id-${index + 2}`,
          projectId,
          userId: member.userId,
          role: member.role || 'MEMBER',
          isActive: true,
        });
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      data: {
        project: {
          id: projectId,
          name,
          description,
          status: status || 'PLANNING',
          startDate,
          endDate,
          priority: priority || 'MEDIUM',
          budget: budget || null,
          teamId: req.params.teamId,
          organizationId: req.params.organizationId,
          lastModifiedBy: 'mock-user-id',
          createdBy: 'mock-user-id',
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        projectOwner: projectLeader,
        members: projectMembers,
      },
    });
  },

  updateProject: (req, res) => {
    const { projectId } = req.params;
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

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: ['Project name is required'],
      });
    }

    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
      });
    }

    if (
      projectId !== 'mock-project-id-1' &&
      projectId !== 'mock-project-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (name === 'Existing Project' && req.query.nameExists === 'true') {
      return res.status(400).json({
        success: false,
        message: 'A project with this name already exists in this organization',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: {
        id: projectId,
        name,
        description,
        status: status || 'PLANNING',
        startDate: startDate
          ? new Date(startDate).toISOString()
          : new Date().toISOString(),
        endDate: endDate
          ? new Date(endDate).toISOString()
          : new Date(Date.now() + 86400000).toISOString(),
        priority: priority || 'MEDIUM',
        budget: budget || null,
        progress: progress || 0,
        teamId: req.params.teamId,
        organizationId: req.params.organizationId,
        lastModifiedBy: 'mock-user-id',
        createdBy: 'mock-user-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateProjectStatus: (req, res) => {
    const { projectId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

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

    if (
      projectId !== 'mock-project-id-1' &&
      projectId !== 'mock-project-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Project status updated successfully',
      data: {
        id: projectId,
        name: projectId === 'mock-project-id-1' ? 'Project 1' : 'Project 2',
        status,
        lastModifiedBy: 'mock-user-id',
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateProjectPriority: (req, res) => {
    const { projectId } = req.params;
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({
        success: false,
        message: 'Priority is required',
      });
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Priority must be one of: ${validPriorities.join(', ')}`,
      });
    }

    if (
      projectId !== 'mock-project-id-1' &&
      projectId !== 'mock-project-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Project priority updated successfully',
      data: {
        id: projectId,
        name: projectId === 'mock-project-id-1' ? 'Project 1' : 'Project 2',
        priority,
        lastModifiedBy: 'mock-user-id',
        updatedAt: new Date().toISOString(),
      },
    });
  },

  deleteProject: (req, res) => {
    const { projectId } = req.params;

    if (
      projectId !== 'mock-project-id-1' &&
      projectId !== 'mock-project-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  },

  restoreProject: (req, res) => {
    const { projectId } = req.params;

    if (
      projectId !== 'mock-project-id-1' &&
      projectId !== 'mock-project-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Project restored successfully',
    });
  },

  addProjectMember: (req, res) => {
    const { projectId } = req.params;
    const { members } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        message: 'Members should be a non-empty array',
      });
    }

    if (
      projectId !== 'mock-project-id-1' &&
      projectId !== 'mock-project-id-2'
    ) {
      return res.status(404).json({
        message: 'Project not found',
      });
    }

    // Simulate some users not found
    const nonExistingUserIds = members
      .filter((member) => member.userId.includes('not-found'))
      .map((member) => member.userId);

    if (nonExistingUserIds.length === members.length) {
      return res.status(404).json({
        message: 'None of the specified users were found',
        userIds: nonExistingUserIds,
      });
    }

    const validMemberCount = members.length - nonExistingUserIds.length;

    return res.status(201).json({
      success: true,
      message: `Successfully added ${validMemberCount} members to the project`,
      data: {
        count: validMemberCount,
        skipped: {
          alreadyMembers: 0,
          nonExistingUsers: nonExistingUserIds.length,
          nonExistingUserIds,
        },
      },
    });
  },

  removeProjectMember: (req, res) => {
    const { projectId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: 'User ID is required',
      });
    }

    if (
      projectId !== 'mock-project-id-1' &&
      projectId !== 'mock-project-id-2'
    ) {
      return res.status(404).json({
        message: 'Project not found',
      });
    }

    if (userId === 'not-found-user-id') {
      return res.status(404).json({
        message: 'User is not a member of this project',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Member removed from project successfully',
    });
  },

  getAllProjects: (req, res) => {
    const { teamId } = req.params;

    if (teamId !== 'mock-team-id-1' && teamId !== 'mock-team-id-2') {
      return res.status(404).json({
        message: 'Team not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: [
        {
          id: 'mock-project-id-1',
          name: 'Project 1',
          description: 'Description for Project 1',
          status: 'IN_PROGRESS',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
          priority: 'HIGH',
          budget: 10000,
          progress: 50,
          teamId,
          organizationId: req.params.organizationId,
          createdBy: 'mock-user-id',
          lastModifiedBy: 'mock-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          memberCount: 3,
        },
        {
          id: 'mock-project-id-2',
          name: 'Project 2',
          description: 'Description for Project 2',
          status: 'PLANNING',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000 * 60).toISOString(),
          priority: 'MEDIUM',
          budget: 5000,
          progress: 0,
          teamId,
          organizationId: req.params.organizationId,
          createdBy: 'mock-user-id',
          lastModifiedBy: 'mock-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          memberCount: 2,
        },
      ],
    });
  },

  getSpecificProject: (req, res) => {
    const { projectId } = req.params;

    if (
      projectId !== 'mock-project-id-1' &&
      projectId !== 'mock-project-id-2'
    ) {
      return res.status(404).json({
        message: 'Project not found',
      });
    }

    const isFirstProject = projectId === 'mock-project-id-1';
    const projectName = isFirstProject ? 'Project 1' : 'Project 2';
    const projectDescription = isFirstProject
      ? 'Description for Project 1'
      : 'Description for Project 2';
    const projectStatus = isFirstProject ? 'IN_PROGRESS' : 'PLANNING';
    const projectPriority = isFirstProject ? 'HIGH' : 'MEDIUM';
    const projectBudget = isFirstProject ? 10000 : 5000;
    const projectProgress = isFirstProject ? 50 : 0;

    return res.status(200).json({
      success: true,
      data: {
        id: projectId,
        name: projectName,
        description: projectDescription,
        status: projectStatus,
        startDate: new Date().toISOString(),
        endDate: new Date(
          Date.now() + 86400000 * (isFirstProject ? 30 : 60),
        ).toISOString(),
        priority: projectPriority,
        budget: projectBudget,
        progress: projectProgress,
        teamId: req.params.teamId,
        organizationId: req.params.organizationId,
        createdBy: 'mock-user-id',
        lastModifiedBy: 'mock-user-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [
          {
            id: 'mock-project-member-id-1',
            userId: 'mock-user-id',
            role: 'PROJECT_OWNER',
            joinedAt: new Date().toISOString(),
            isActive: true,
            user: {
              id: 'mock-user-id',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
              profilePic: null,
            },
          },
          {
            id: 'mock-project-member-id-2',
            userId: 'mock-user-id-2',
            role: 'MEMBER',
            joinedAt: new Date().toISOString(),
            isActive: true,
            user: {
              id: 'mock-user-id-2',
              firstName: 'Test2',
              lastName: 'User2',
              email: 'test2@example.com',
              profilePic: null,
            },
          },
        ],
        tasks: [
          {
            id: 'mock-task-id-1',
            title: 'Task 1',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
          },
          {
            id: 'mock-task-id-2',
            title: 'Task 2',
            status: 'NOT_STARTED',
            priority: 'MEDIUM',
            dueDate: new Date(Date.now() + 86400000 * 14).toISOString(),
          },
        ],
        memberCount: 2,
        taskCount: 2,
        userRole: 'PROJECT_OWNER',
      },
    });
  },

  getProjectsInSpecificOrg: (req, res) => {
    const { page = 1, limit = 10, includeTasks = 'true' } = req.query;

    return res.status(200).json({
      success: true,
      message: "Organization's projects retrieved successfully",
      data: {
        activeProjects: [
          {
            id: 'mock-project-id-1',
            name: 'Project 1',
            description: 'Description for Project 1',
            status: 'IN_PROGRESS',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
            priority: 'HIGH',
            progress: 50,
            budget: 10000,
            team: {
              id: 'mock-team-id-1',
              name: 'Frontend Team',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            memberCount: 3,
            members: [
              {
                userId: 'mock-user-id',
                role: 'PROJECT_OWNER',
                firstName: 'Test',
                lastName: 'User',
                profilePic: null,
              },
              {
                userId: 'mock-user-id-2',
                role: 'MEMBER',
                firstName: 'Test2',
                lastName: 'User2',
                profilePic: null,
              },
            ],
            hasMoreMembers: false,
            userRole: 'PROJECT_OWNER',
            taskStats: {
              total: 3,
              notStarted: 1,
              inProgress: 1,
              completed: 1,
              overdue: 0,
            },
            tasks:
              includeTasks === 'true'
                ? [
                    {
                      id: 'mock-task-id-1',
                      title: 'Task 1',
                      description: 'Description for Task 1',
                      priority: 'HIGH',
                      status: 'IN_PROGRESS',
                      dueDate: new Date(
                        Date.now() + 86400000 * 7,
                      ).toISOString(),
                      estimatedTime: 8,
                      actualTime: 4,
                      labels: ['frontend', 'bug'],
                      subtaskCount: 2,
                      commentCount: 3,
                      attachmentCount: 1,
                      assignee: {
                        id: 'mock-user-id',
                        firstName: 'Test',
                        lastName: 'User',
                        profilePic: null,
                      },
                      isOverdue: false,
                    },
                    {
                      id: 'mock-task-id-2',
                      title: 'Task 2',
                      description: 'Description for Task 2',
                      priority: 'MEDIUM',
                      status: 'NOT_STARTED',
                      dueDate: new Date(
                        Date.now() + 86400000 * 14,
                      ).toISOString(),
                      estimatedTime: 5,
                      actualTime: 0,
                      labels: ['backend'],
                      subtaskCount: 0,
                      commentCount: 0,
                      attachmentCount: 0,
                      assignee: null,
                      isOverdue: false,
                    },
                  ]
                : undefined,
            hasMoreTasks: false,
          },
          {
            id: 'mock-project-id-2',
            name: 'Project 2',
            description: 'Description for Project 2',
            status: 'PLANNING',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 86400000 * 60).toISOString(),
            priority: 'MEDIUM',
            progress: 0,
            budget: 5000,
            team: {
              id: 'mock-team-id-2',
              name: 'Backend Team',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            memberCount: 2,
            members: [
              {
                userId: 'mock-user-id',
                role: 'PROJECT_OWNER',
                firstName: 'Test',
                lastName: 'User',
                profilePic: null,
              },
            ],
            hasMoreMembers: false,
            userRole: 'PROJECT_OWNER',
            taskStats: {
              total: 1,
              notStarted: 1,
              inProgress: 0,
              completed: 0,
              overdue: 0,
            },
            tasks:
              includeTasks === 'true'
                ? [
                    {
                      id: 'mock-task-id-3',
                      title: 'Task 3',
                      description: 'Description for Task 3',
                      priority: 'LOW',
                      status: 'NOT_STARTED',
                      dueDate: new Date(
                        Date.now() + 86400000 * 21,
                      ).toISOString(),
                      estimatedTime: 3,
                      actualTime: 0,
                      labels: ['documentation'],
                      subtaskCount: 0,
                      commentCount: 0,
                      attachmentCount: 0,
                      assignee: null,
                      isOverdue: false,
                    },
                  ]
                : undefined,
            hasMoreTasks: false,
          },
        ],
        archivedProjects: [
          {
            id: 'mock-project-id-3',
            name: 'Archived Project',
            description: 'This project has been archived',
            status: 'COMPLETED',
            startDate: new Date(Date.now() - 86400000 * 60).toISOString(),
            endDate: new Date(Date.now() - 86400000 * 30).toISOString(),
            deletedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
            priority: 'LOW',
            progress: 100,
            team: {
              id: 'mock-team-id-1',
              name: 'Frontend Team',
            },
            taskCount: 5,
            memberCount: 3,
          },
        ],
        statistics: {
          totalActiveProjects: 2,
          totalArchivedProjects: 1,
          totalProjects: 3,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 1,
          totalItems: 2,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
  },
};

// Apply mock controller to routes
router.use(mockAuthMiddleware);
router.get('/', mockProjectController.getAllProjects);
router.get('/:projectId', mockProjectController.getSpecificProject);
router.post('/', mockProjectController.createProject);
router.put('/:projectId', mockProjectController.updateProject);
router.patch('/:projectId/status', mockProjectController.updateProjectStatus);
router.patch(
  '/:projectId/priority',
  mockProjectController.updateProjectPriority,
);
router.delete('/:projectId', mockProjectController.deleteProject);
router.patch('/:projectId/restore', mockProjectController.restoreProject);
router.post('/:projectId/members', mockProjectController.addProjectMember);
router.delete('/:projectId/members', mockProjectController.removeProjectMember);

// Organization-level project routes
const orgRouter = express.Router({ mergeParams: true });
orgRouter.use(mockAuthMiddleware);
orgRouter.get('/', mockProjectController.getProjectsInSpecificOrg);

export { orgRouter };
export default router;
