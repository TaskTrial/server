import express from 'express';
import { mockAuthMiddleware } from './middleware.mock.js';

const router = express.Router({ mergeParams: true });

// Mock sprint controller functions
export const mockSprintController = {
  createSprint: (req, res) => {
    const { name, description, startDate, endDate, goal } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: ['Sprint name is required'],
      });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
      });
    }

    if (name === 'Existing Sprint') {
      return res.status(400).json({
        success: false,
        message: 'A sprint with this name already exists in this project',
      });
    }

    // Check for overlapping sprints
    if (name === 'Overlapping Sprint') {
      return res.status(400).json({
        success: false,
        message: 'Sprint dates overlap with existing sprint',
        data: {
          overlappingSprint: {
            id: 'mock-sprint-id-overlap',
            name: 'Existing Sprint',
            startDate: new Date(Date.now()).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 14).toISOString(),
          },
        },
      });
    }

    // Calculate status based on dates
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    let status = 'PLANNING';

    if (now < start) {
      status = 'PLANNING';
    } else if (now >= start && now <= end) {
      status = 'ACTIVE';
    } else {
      status = 'COMPLETED';
    }

    const sprintId = 'mock-sprint-id-new';

    return res.status(201).json({
      success: true,
      message: 'Sprint created successfully',
      data: {
        id: sprintId,
        name,
        description,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        status,
        goal,
        order: 0,
        projectId: req.params.projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateSprint: (req, res) => {
    const { sprintId } = req.params;
    const { name, description, startDate, endDate, goal, status, order } =
      req.body;

    if (sprintId !== 'mock-sprint-id-1' && sprintId !== 'mock-sprint-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found',
      });
    }

    if (name === 'Existing Sprint' && req.query.nameExists === 'true') {
      return res.status(400).json({
        success: false,
        message: 'A sprint with this name already exists in this project',
      });
    }

    // Check for date validation if both are provided
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
      });
    }

    // Check for overlapping sprints
    if (name === 'Overlapping Sprint') {
      return res.status(400).json({
        success: false,
        message: 'Sprint dates overlap with existing sprint',
        data: {
          overlappingSprint: {
            id: 'mock-sprint-id-overlap',
            name: 'Existing Sprint',
            startDate: new Date(Date.now()).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 14).toISOString(),
          },
        },
      });
    }

    const isFirstSprint = sprintId === 'mock-sprint-id-1';
    const sprintName = name || (isFirstSprint ? 'Sprint 1' : 'Sprint 2');
    const sprintDescription =
      description ||
      (isFirstSprint ? 'Description for Sprint 1' : 'Description for Sprint 2');
    const sprintStatus = status || (isFirstSprint ? 'ACTIVE' : 'PLANNING');
    const sprintGoal =
      goal || (isFirstSprint ? 'Complete feature X' : 'Plan feature Y');
    const sprintOrder = order !== undefined ? order : isFirstSprint ? 0 : 1;

    return res.status(200).json({
      success: true,
      message: 'Sprint updated successfully',
      data: {
        id: sprintId,
        name: sprintName,
        description: sprintDescription,
        startDate: startDate
          ? new Date(startDate).toISOString()
          : new Date().toISOString(),
        endDate: endDate
          ? new Date(endDate).toISOString()
          : new Date(Date.now() + 86400000 * 14).toISOString(),
        status: sprintStatus,
        goal: sprintGoal,
        order: sprintOrder,
        projectId: req.params.projectId,
        lastModifiedAt: new Date().toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateSprintStatus: (req, res) => {
    const { sprintId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    if (sprintId !== 'mock-sprint-id-1' && sprintId !== 'mock-sprint-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found',
      });
    }

    // Validate status transitions
    const validTransitions = {
      PLANNING: ['ACTIVE', 'COMPLETED'],
      ACTIVE: ['COMPLETED'],
      COMPLETED: [],
    };

    const currentStatus =
      sprintId === 'mock-sprint-id-1' ? 'PLANNING' : 'ACTIVE';

    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${currentStatus} to ${status}`,
        validTransitions: validTransitions[currentStatus],
      });
    }

    // Special case for ACTIVE status
    if (
      status === 'ACTIVE' &&
      sprintId === 'mock-sprint-id-2' &&
      req.query.beforeStartDate === 'true'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Cannot activate sprint before its start date',
      });
    }

    // Special case for COMPLETED status with incomplete tasks
    if (status === 'COMPLETED' && req.query.hasIncompleteTasks === 'true') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete sprint with unfinished tasks',
        incompleteTasks: 3,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sprint status updated successfully',
      data: {
        id: sprintId,
        name: sprintId === 'mock-sprint-id-1' ? 'Sprint 1' : 'Sprint 2',
        status,
        startDate:
          status === 'ACTIVE'
            ? new Date().toISOString()
            : new Date(Date.now() - 86400000).toISOString(),
        endDate:
          status === 'COMPLETED'
            ? new Date().toISOString()
            : new Date(Date.now() + 86400000 * 14).toISOString(),
        projectId: req.params.projectId,
        updatedAt: new Date().toISOString(),
        project: {
          name: 'Test Project',
        },
        updatedBy: {
          id: 'mock-user-id',
          name: 'Test User',
          role: 'PROJECT_OWNER',
        },
      },
    });
  },

  getAllSprints: (req, res) => {
    const { projectId } = req.params;
    const { page = 1, pageSize = 10, status } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required',
      });
    }

    const sprints = [
      {
        id: 'mock-sprint-id-1',
        name: 'Sprint 1',
        description: 'Description for Sprint 1',
        startDate: new Date(Date.now() - 86400000 * 7).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        status: 'ACTIVE',
        goal: 'Complete feature X',
        taskCount: 5,
        createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      },
      {
        id: 'mock-sprint-id-2',
        name: 'Sprint 2',
        description: 'Description for Sprint 2',
        startDate: new Date(Date.now() + 86400000 * 8).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 21).toISOString(),
        status: 'PLANNING',
        goal: 'Plan feature Y',
        taskCount: 3,
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
    ];

    // Filter by status if provided
    const filteredSprints = status
      ? sprints.filter((sprint) => sprint.status === status)
      : sprints;

    const pageInt = parseInt(page, 10);
    const pageSizeInt = parseInt(pageSize, 10);

    return res.status(200).json({
      success: true,
      data: filteredSprints,
      pagination: {
        currentPage: pageInt,
        pageSize: pageSizeInt,
        totalItems: filteredSprints.length,
        totalPages: Math.ceil(filteredSprints.length / pageSizeInt),
      },
    });
  },

  getSpecificSprint: (req, res) => {
    const { sprintId } = req.params;

    if (sprintId !== 'mock-sprint-id-1' && sprintId !== 'mock-sprint-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found',
      });
    }

    const isFirstSprint = sprintId === 'mock-sprint-id-1';

    const sprint = {
      id: sprintId,
      name: isFirstSprint ? 'Sprint 1' : 'Sprint 2',
      description: isFirstSprint
        ? 'Description for Sprint 1'
        : 'Description for Sprint 2',
      startDate: isFirstSprint
        ? new Date(Date.now() - 86400000 * 7).toISOString()
        : new Date(Date.now() + 86400000 * 8).toISOString(),
      endDate: isFirstSprint
        ? new Date(Date.now() + 86400000 * 7).toISOString()
        : new Date(Date.now() + 86400000 * 21).toISOString(),
      status: isFirstSprint ? 'ACTIVE' : 'PLANNING',
      goal: isFirstSprint ? 'Complete feature X' : 'Plan feature Y',
      createdAt: isFirstSprint
        ? new Date(Date.now() - 86400000 * 14).toISOString()
        : new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
      projectId: 'mock-project-id-1',
      project: {
        id: 'mock-project-id-1',
        name: 'Test Project',
        status: 'ACTIVE',
      },
      tasks: [
        {
          id: isFirstSprint ? 'mock-task-id-1' : 'mock-task-id-3',
          title: isFirstSprint ? 'Task 1' : 'Task 3',
          status: isFirstSprint ? 'IN_PROGRESS' : 'TODO',
          priority: isFirstSprint ? 'HIGH' : 'MEDIUM',
          dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
          assignee: {
            id: 'mock-user-id',
            firstName: 'Test',
            lastName: 'User',
            profilePic: null,
          },
        },
        {
          id: isFirstSprint ? 'mock-task-id-2' : 'mock-task-id-4',
          title: isFirstSprint ? 'Task 2' : 'Task 4',
          status: isFirstSprint ? 'DONE' : 'TODO',
          priority: isFirstSprint ? 'MEDIUM' : 'LOW',
          dueDate: new Date(Date.now() + 86400000 * 6).toISOString(),
          assignee: null,
        },
      ],
      activityLogs: [
        {
          id: `mock-activity-log-id-1-${sprintId}`,
          action: 'CREATED',
          entityType: 'SPRINT',
          createdAt: isFirstSprint
            ? new Date(Date.now() - 86400000 * 14).toISOString()
            : new Date(Date.now() - 86400000 * 3).toISOString(),
          user: {
            id: 'mock-user-id',
            firstName: 'Test',
            lastName: 'User',
          },
        },
        {
          id: `mock-activity-log-id-2-${sprintId}`,
          action: 'UPDATED',
          entityType: 'SPRINT',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          user: {
            id: 'mock-user-id',
            firstName: 'Test',
            lastName: 'User',
          },
        },
      ],
      _count: {
        tasks: isFirstSprint ? 5 : 3,
        activityLogs: 2,
      },
      progress: isFirstSprint ? 40 : 0,
      daysRemaining: isFirstSprint ? 7 : 21,
      stats: {
        totalTasks: isFirstSprint ? 5 : 3,
        completedTasks: isFirstSprint ? 2 : 0,
        activityCount: 2,
      },
    };

    return res.status(200).json({
      success: true,
      data: sprint,
    });
  },

  deleteSprint: (req, res) => {
    const { sprintId } = req.params;

    if (sprintId !== 'mock-sprint-id-1' && sprintId !== 'mock-sprint-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found',
      });
    }

    // Special case for active sprints with unfinished tasks
    if (
      sprintId === 'mock-sprint-id-1' &&
      req.query.hasUnfinishedTasks === 'true'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active sprint with unfinished tasks',
        unfinishedTasks: 3,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sprint deleted successfully',
      data: {
        id: sprintId,
        name: sprintId === 'mock-sprint-id-1' ? 'Sprint 1' : 'Sprint 2',
        deletedAt: new Date().toISOString(),
      },
    });
  },
};

// Apply mock controller to routes
router.use(mockAuthMiddleware);
router.get('/', mockSprintController.getAllSprints);
router.get('/:sprintId', mockSprintController.getSpecificSprint);
router.post('/', mockSprintController.createSprint);
router.put('/:sprintId', mockSprintController.updateSprint);
router.patch('/:sprintId/status', mockSprintController.updateSprintStatus);
router.delete('/:sprintId', mockSprintController.deleteSprint);

export default router;
