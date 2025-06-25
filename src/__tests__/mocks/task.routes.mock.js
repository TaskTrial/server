import express from 'express';
import { mockAuthMiddleware } from './middleware.mock.js';

const router = express.Router({ mergeParams: true });

// Mock task controller functions
export const mockTaskController = {
  createTask: (req, res) => {
    const {
      title,
      description,
      priority,
      sprintId,
      assignedTo,
      dueDate,
      estimatedTime,
      parentId,
      labels,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Due date is required',
      });
    }

    if (!priority || !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Valid priority (HIGH, MEDIUM, LOW) is required',
      });
    }

    // Check if sprint exists
    if (
      sprintId &&
      sprintId !== 'mock-sprint-id-1' &&
      sprintId !== 'mock-sprint-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found or does not belong to the specified project',
      });
    }

    // Check if parent task exists
    if (
      parentId &&
      parentId !== 'mock-task-id-1' &&
      parentId !== 'mock-task-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message:
          'Parent task not found or does not belong to the specified project',
      });
    }

    // Check if assigned user exists
    if (
      assignedTo &&
      assignedTo !== 'mock-user-id' &&
      assignedTo !== 'mock-user-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found',
      });
    }

    // Check if assigned user is a project member
    if (assignedTo === 'not-project-member') {
      return res.status(400).json({
        success: false,
        message: 'Assigned user is not a member of the project',
      });
    }

    const taskId = 'mock-task-id-new';

    const task = {
      id: taskId,
      title,
      description: description || null,
      priority,
      status: 'TODO',
      projectId: req.params.projectId,
      sprintId: sprintId || null,
      createdBy: 'mock-user-id',
      assignedTo: assignedTo || null,
      dueDate: new Date(dueDate).toISOString(),
      estimatedTime: estimatedTime || null,
      parentId: parentId || null,
      order: 0,
      labels: labels || [],
      lastModifiedBy: 'mock-user-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock project members
    const projectMembers = [
      {
        id: 'mock-project-member-id-1',
        projectId: req.params.projectId,
        userId: 'mock-user-id',
        role: 'PROJECT_OWNER',
      },
      {
        id: 'mock-project-member-id-2',
        projectId: req.params.projectId,
        userId: 'mock-user-id-2',
        role: 'MEMBER',
      },
    ];

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task,
      project_members: projectMembers,
    });
  },

  updateTask: (req, res) => {
    const { taskId } = req.params;
    const {
      title,
      description,
      status,
      priority,
      sprintId,
      assignedTo,
      dueDate,
      estimatedTime,
      parentId,
      labels,
    } = req.body;

    if (taskId !== 'mock-task-id-1' && taskId !== 'mock-task-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    }

    // Check if sprint exists
    if (
      sprintId &&
      sprintId !== 'mock-sprint-id-1' &&
      sprintId !== 'mock-sprint-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found or does not belong to the specified project',
      });
    }

    // Check if parent task exists
    if (
      parentId &&
      parentId !== 'mock-task-id-1' &&
      parentId !== 'mock-task-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message:
          'Parent task not found or does not belong to the specified project',
      });
    }

    // Check for circular dependency
    if (parentId === taskId) {
      return res.status(400).json({
        success: false,
        message: 'A task cannot be its own parent',
      });
    }

    // Check for circular dependency in hierarchy
    if (parentId === 'circular-dependency') {
      return res.status(400).json({
        success: false,
        message: 'Circular dependency detected in task hierarchy',
      });
    }

    // Check if assigned user exists
    if (
      assignedTo &&
      assignedTo !== 'mock-user-id' &&
      assignedTo !== 'mock-user-id-2'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found',
      });
    }

    const isFirstTask = taskId === 'mock-task-id-1';
    const taskTitle = title || (isFirstTask ? 'Task 1' : 'Task 2');
    const taskDescription =
      description ||
      (isFirstTask ? 'Description for Task 1' : 'Description for Task 2');
    const taskStatus = status || (isFirstTask ? 'IN_PROGRESS' : 'TODO');
    const taskPriority = priority || (isFirstTask ? 'HIGH' : 'MEDIUM');
    const taskDueDate = dueDate
      ? new Date(dueDate).toISOString()
      : new Date(Date.now() + 86400000 * (isFirstTask ? 5 : 10)).toISOString();

    const updatedTask = {
      id: taskId,
      title: taskTitle,
      description: taskDescription,
      status: taskStatus,
      priority: taskPriority,
      projectId: req.params.projectId,
      sprintId:
        sprintId !== undefined
          ? sprintId
          : isFirstTask
            ? 'mock-sprint-id-1'
            : null,
      createdBy: 'mock-user-id',
      assignedTo:
        assignedTo !== undefined
          ? assignedTo
          : isFirstTask
            ? 'mock-user-id'
            : null,
      dueDate: taskDueDate,
      estimatedTime:
        estimatedTime !== undefined ? estimatedTime : isFirstTask ? 8 : 5,
      parentId: parentId !== undefined ? parentId : null,
      order: isFirstTask ? 0 : 1,
      labels: labels || (isFirstTask ? ['bug', 'frontend'] : ['feature']),
      lastModifiedBy: 'mock-user-id',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask,
    });
  },

  updateTaskPriority: (req, res) => {
    const { taskId } = req.params;
    const { priority } = req.body;

    if (taskId !== 'mock-task-id-1' && taskId !== 'mock-task-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    }

    if (!priority || !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Valid priority (HIGH, MEDIUM, LOW) is required',
      });
    }

    const isFirstTask = taskId === 'mock-task-id-1';

    const updatedTask = {
      id: taskId,
      title: isFirstTask ? 'Task 1' : 'Task 2',
      priority,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: 'mock-user-id',
    };

    return res.status(200).json({
      success: true,
      message: 'Task priority updated successfully',
      task: updatedTask,
    });
  },

  updateTaskStatus: (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;

    if (taskId !== 'mock-task-id-1' && taskId !== 'mock-task-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    }

    const validStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Valid status (${validStatuses.join(', ')}) is required`,
      });
    }

    const isFirstTask = taskId === 'mock-task-id-1';

    const updatedTask = {
      id: taskId,
      title: isFirstTask ? 'Task 1' : 'Task 2',
      status,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: 'mock-user-id',
    };

    return res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      task: updatedTask,
    });
  },

  getAllTasks: (req, res) => {
    const { projectId } = req.params;
    const {
      sprintId,
      priority,
      status,
      assignedTo,
      parentId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Build filter conditions
    let tasks = [
      {
        id: 'mock-task-id-1',
        title: 'Task 1',
        description: 'Description for Task 1',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        projectId,
        sprintId: 'mock-sprint-id-1',
        createdBy: 'mock-user-id',
        assignedTo: 'mock-user-id',
        dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        estimatedTime: 8,
        actualTime: 4,
        parentId: null,
        order: 0,
        labels: ['bug', 'frontend'],
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        creator: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          profilePic: null,
        },
        assignee: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          profilePic: null,
        },
        sprint: {
          id: 'mock-sprint-id-1',
          name: 'Sprint 1',
          status: 'ACTIVE',
        },
        subtasks: [
          {
            id: 'mock-task-id-3',
            title: 'Subtask 1',
            status: 'TODO',
            priority: 'MEDIUM',
          },
        ],
        _count: {
          comments: 2,
          attachments: 1,
          subtasks: 1,
        },
      },
      {
        id: 'mock-task-id-2',
        title: 'Task 2',
        description: 'Description for Task 2',
        priority: 'MEDIUM',
        status: 'TODO',
        projectId,
        sprintId: null,
        createdBy: 'mock-user-id',
        assignedTo: null,
        dueDate: new Date(Date.now() + 86400000 * 10).toISOString(),
        estimatedTime: 5,
        actualTime: 0,
        parentId: null,
        order: 1,
        labels: ['feature'],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        creator: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          profilePic: null,
        },
        assignee: null,
        sprint: null,
        subtasks: [],
        _count: {
          comments: 0,
          attachments: 0,
          subtasks: 0,
        },
      },
    ];

    // Apply filters
    if (sprintId) {
      tasks = tasks.filter((task) => {
        if (sprintId === 'null') {
          return task.sprintId === null;
        }
        return task.sprintId === sprintId;
      });
    }

    if (priority) {
      tasks = tasks.filter((task) => task.priority === priority);
    }

    if (status) {
      tasks = tasks.filter((task) => task.status === status);
    }

    if (assignedTo) {
      tasks = tasks.filter((task) => {
        if (assignedTo === 'null') {
          return task.assignedTo === null;
        } else if (assignedTo === 'me') {
          return task.assignedTo === 'mock-user-id';
        }
        return task.assignedTo === assignedTo;
      });
    }

    if (parentId) {
      tasks = tasks.filter((task) => {
        if (parentId === 'null') {
          return task.parentId === null;
        }
        return task.parentId === parentId;
      });
    }

    if (search) {
      tasks = tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(search.toLowerCase()) ||
          (task.description &&
            task.description.toLowerCase().includes(search.toLowerCase())),
      );
    }

    // Pagination
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const totalCount = tasks.length;
    const startIndex = (pageInt - 1) * limitInt;
    const endIndex = startIndex + limitInt;
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    return res.status(200).json({
      success: true,
      tasks: paginatedTasks,
      pagination: {
        total: totalCount,
        page: pageInt,
        limit: limitInt,
        pages: Math.ceil(totalCount / limitInt),
      },
    });
  },

  getSpecificTask: (req, res) => {
    const { taskId } = req.params;

    if (taskId !== 'mock-task-id-1' && taskId !== 'mock-task-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    }

    const isFirstTask = taskId === 'mock-task-id-1';

    const task = {
      id: taskId,
      title: isFirstTask ? 'Task 1' : 'Task 2',
      description: isFirstTask
        ? 'Description for Task 1'
        : 'Description for Task 2',
      priority: isFirstTask ? 'HIGH' : 'MEDIUM',
      status: isFirstTask ? 'IN_PROGRESS' : 'TODO',
      projectId: req.params.projectId,
      sprintId: isFirstTask ? 'mock-sprint-id-1' : null,
      createdBy: 'mock-user-id',
      assignedTo: isFirstTask ? 'mock-user-id' : null,
      dueDate: new Date(
        Date.now() + 86400000 * (isFirstTask ? 5 : 10),
      ).toISOString(),
      estimatedTime: isFirstTask ? 8 : 5,
      actualTime: isFirstTask ? 4 : 0,
      parentId: null,
      order: isFirstTask ? 0 : 1,
      labels: isFirstTask ? ['bug', 'frontend'] : ['feature'],
      createdAt: new Date(
        Date.now() - 86400000 * (isFirstTask ? 2 : 1),
      ).toISOString(),
      updatedAt: isFirstTask
        ? new Date(Date.now() - 86400000).toISOString()
        : new Date().toISOString(),
      creator: {
        id: 'mock-user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        profilePic: null,
      },
      modifier: {
        id: 'mock-user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        profilePic: null,
      },
      assignee: isFirstTask
        ? {
            id: 'mock-user-id',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            profilePic: null,
          }
        : null,
      sprint: isFirstTask
        ? {
            id: 'mock-sprint-id-1',
            name: 'Sprint 1',
            status: 'ACTIVE',
            startDate: new Date(Date.now() - 86400000 * 7).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
          }
        : null,
      subtasks: isFirstTask
        ? [
            {
              id: 'mock-task-id-3',
              title: 'Subtask 1',
              status: 'TODO',
              priority: 'MEDIUM',
              assignedTo: null,
              dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
              assignee: null,
            },
          ]
        : [],
      parent: null,
      dependentOn: [],
      dependencies: [],
      comments: isFirstTask
        ? [
            {
              id: 'mock-comment-id-1',
              content: 'This is a comment',
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              user: {
                id: 'mock-user-id',
                firstName: 'Test',
                lastName: 'User',
                profilePic: null,
              },
            },
          ]
        : [],
      attachments: isFirstTask
        ? [
            {
              id: 'mock-attachment-id-1',
              filename: 'attachment.pdf',
              url: 'https://example.com/attachment.pdf',
              size: 1024,
              contentType: 'application/pdf',
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              uploader: {
                id: 'mock-user-id',
                firstName: 'Test',
                lastName: 'User',
                profilePic: null,
              },
            },
          ]
        : [],
    };

    return res.status(200).json({
      success: true,
      task,
    });
  },

  deleteTask: (req, res) => {
    const { taskId } = req.params;
    const { permanent = false } = req.query;

    if (taskId !== 'mock-task-id-1' && taskId !== 'mock-task-id-2') {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    }

    // If permanent deletion but not admin
    if (permanent === 'true' && req.query.isAdmin !== 'true') {
      return res.status(403).json({
        success: false,
        message:
          'Only administrators or organization owners can permanently delete tasks',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Task ${permanent === 'true' ? 'permanently ' : ''}deleted successfully`,
    });
  },

  restoreTask: (req, res) => {
    const { taskId } = req.params;
    const { restoreSubtasks = true } = req.body;

    if (taskId !== 'mock-task-id-1' && taskId !== 'mock-task-id-2') {
      return res.status(404).json({
        success: false,
        message:
          'Task not found, already active, or does not belong to the specified project',
      });
    }

    // Check if parent task is deleted
    if (taskId === 'mock-task-id-3') {
      return res.status(400).json({
        success: false,
        message:
          'Cannot restore task because its parent task is deleted. Please restore the parent task first.',
      });
    }

    const isFirstTask = taskId === 'mock-task-id-1';

    const restoredTask = {
      id: taskId,
      title: isFirstTask ? 'Task 1' : 'Task 2',
      createdBy: 'mock-user-id',
      _count: {
        subtasks: isFirstTask ? 1 : 0,
      },
      creator: {
        id: 'mock-user-id',
        firstName: 'Test',
        lastName: 'User',
        profilePic: null,
      },
    };

    return res.status(200).json({
      success: true,
      message: `Task restored successfully${restoreSubtasks ? ' with its subtasks' : ''}`,
      task: restoredTask,
    });
  },

  getTasksInSpecificOrg: (req, res) => {
    const {
      projectId,
      projectName,
      assignedTo,
      status,
      priority,
      page = 1,
      limit = 10,
      includeSubtasks = 'true',
    } = req.query;

    const tasks = [
      {
        id: 'mock-task-id-1',
        title: 'Task 1',
        description: 'Description for Task 1',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        estimatedTime: 8,
        actualTime: 4,
        timeRemaining: 4,
        timeProgress: 50,
        labels: ['bug', 'frontend'],
        project: {
          id: 'mock-project-id-1',
          name: 'Project 1',
          status: 'ACTIVE',
        },
        creator: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          profilePic: null,
        },
        assignee: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          profilePic: null,
        },
        commentCount: 2,
        attachmentCount: 1,
        timelogCount: 3,
        isOverdue: false,
        progress: 50,
        subtaskStats: {
          total: 1,
          completed: 0,
          inProgress: 0,
          notStarted: 1,
          overdue: 0,
        },
        subtasks:
          includeSubtasks === 'true'
            ? [
                {
                  id: 'mock-task-id-3',
                  title: 'Subtask 1',
                  description: 'Description for Subtask 1',
                  priority: 'MEDIUM',
                  status: 'TODO',
                  dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
                  estimatedTime: 3,
                  actualTime: 0,
                  labels: ['bug'],
                  commentCount: 0,
                  attachmentCount: 0,
                  assignee: null,
                  isOverdue: false,
                },
              ]
            : undefined,
        hasMoreSubtasks: false,
      },
      {
        id: 'mock-task-id-2',
        title: 'Task 2',
        description: 'Description for Task 2',
        priority: 'MEDIUM',
        status: 'TODO',
        dueDate: new Date(Date.now() + 86400000 * 10).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        estimatedTime: 5,
        actualTime: 0,
        timeRemaining: 5,
        timeProgress: 0,
        labels: ['feature'],
        project: {
          id: 'mock-project-id-2',
          name: 'Project 2',
          status: 'PLANNING',
        },
        creator: {
          id: 'mock-user-id',
          firstName: 'Test',
          lastName: 'User',
          profilePic: null,
        },
        assignee: null,
        commentCount: 0,
        attachmentCount: 0,
        timelogCount: 0,
        isOverdue: false,
        progress: 0,
        subtaskStats: {
          total: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          overdue: 0,
        },
        subtasks: [],
        hasMoreSubtasks: false,
      },
    ];

    // Apply filters
    let filteredTasks = [...tasks];

    if (projectId) {
      filteredTasks = filteredTasks.filter(
        (task) => task.project.id === projectId,
      );
    } else if (projectName) {
      filteredTasks = filteredTasks.filter((task) =>
        task.project.name.toLowerCase().includes(projectName.toLowerCase()),
      );
    }

    if (assignedTo) {
      filteredTasks = filteredTasks.filter((task) => {
        if (assignedTo === 'me') {
          return task.assignee && task.assignee.id === 'mock-user-id';
        } else if (assignedTo === 'unassigned') {
          return !task.assignee;
        }
        return task.assignee && task.assignee.id === assignedTo;
      });
    }

    if (status) {
      filteredTasks = filteredTasks.filter((task) => task.status === status);
    }

    if (priority) {
      filteredTasks = filteredTasks.filter(
        (task) => task.priority === priority,
      );
    }

    // Pagination
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const totalCount = filteredTasks.length;
    const startIndex = (pageInt - 1) * limitInt;
    const endIndex = startIndex + limitInt;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    // Task statistics
    const taskCountsByStatus = {
      todo: filteredTasks.filter((task) => task.status === 'TODO').length,
      inProgress: filteredTasks.filter((task) => task.status === 'IN_PROGRESS')
        .length,
      review: filteredTasks.filter((task) => task.status === 'REVIEW').length,
      done: filteredTasks.filter((task) => task.status === 'DONE').length,
    };

    const taskCountsByPriority = {
      low: filteredTasks.filter((task) => task.priority === 'LOW').length,
      medium: filteredTasks.filter((task) => task.priority === 'MEDIUM').length,
      high: filteredTasks.filter((task) => task.priority === 'HIGH').length,
    };

    const overdueTasks = filteredTasks.filter(
      (task) => new Date(task.dueDate) < new Date() && task.status !== 'DONE',
    ).length;

    return res.status(200).json({
      success: true,
      message: `Organization's tasks retrieved successfully`,
      data: {
        tasks: paginatedTasks,
        statistics: {
          totalTasks: totalCount,
          byStatus: taskCountsByStatus,
          byPriority: taskCountsByPriority,
          overdue: overdueTasks,
        },
        pagination: {
          page: pageInt,
          limit: limitInt,
          totalPages: Math.ceil(totalCount / limitInt),
          totalItems: totalCount,
          hasNextPage: pageInt < Math.ceil(totalCount / limitInt),
          hasPrevPage: pageInt > 1,
        },
      },
    });
  },
};

// Apply mock controller to routes
router.use(mockAuthMiddleware);
router.get('/', mockTaskController.getAllTasks);
router.get('/:taskId', mockTaskController.getSpecificTask);
router.post('/', mockTaskController.createTask);
router.put('/:taskId', mockTaskController.updateTask);
router.patch('/:taskId/status', mockTaskController.updateTaskStatus);
router.patch('/:taskId/priority', mockTaskController.updateTaskPriority);
router.delete('/:taskId', mockTaskController.deleteTask);
router.patch('/:taskId/restore', mockTaskController.restoreTask);

// Organization-level task routes
const orgRouter = express.Router({ mergeParams: true });
orgRouter.use(mockAuthMiddleware);
orgRouter.get('/', mockTaskController.getTasksInSpecificOrg);

export { orgRouter };
export default router;
