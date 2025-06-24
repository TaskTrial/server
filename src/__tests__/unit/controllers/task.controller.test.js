import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import prisma from '../../../../src/config/prismaClient';
import {
  createTask,
  deleteTask,
  getAllTasks,
  getSpecificTask,
  getTasksInSpecificOrg,
  restoreTask,
  updateTask,
  updateTaskPriority,
  updateTaskStatus,
} from '../../../../src/controllers/task.controller';
import { createActivityLog } from '../../../../src/utils/activityLogs.utils';

jest.mock('../../../../src/config/prismaClient', () => {
  const prismaMock = {
    organization: { findFirst: jest.fn() },
    team: { findFirst: jest.fn() },
    project: { findFirst: jest.fn() },
    sprint: { findFirst: jest.fn() },
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    projectMember: { findFirst: jest.fn(), findMany: jest.fn() },
    taskAttachment: { deleteMany: jest.fn() },
    comment: { deleteMany: jest.fn() },
    taskDependency: { deleteMany: jest.fn() },
    timelog: { deleteMany: jest.fn() },
    activityLog: { deleteMany: jest.fn() },
  };
  prismaMock.$transaction = jest
    .fn()
    .mockImplementation(async (callback) => callback(prismaMock));
  return {
    __esModule: true,
    default: prismaMock,
  };
});

jest.mock('../../../../src/utils/activityLogs.utils', () => ({
  createActivityLog: jest.fn(),
  generateActivityDetails: jest.fn((action, before, after) => ({
    action,
    before,
    after,
  })),
}));

describe('Task Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'userId', role: 'USER' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
      };
      req.body = {
        title: 'New Task',
        priority: 'HIGH',
        dueDate: new Date().toISOString(),
      };
      req.user = { id: 'userId', role: 'ADMIN' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [{ userId: 'userId' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue(null);
      prisma.task.create.mockResolvedValue({ id: 'taskId', ...req.body });
      prisma.projectMember.findMany.mockResolvedValue([]);

      await createTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Task created successfully',
        }),
      );
      expect(createActivityLog).toHaveBeenCalled();
    });

    it('should return 400 for validation error', async () => {
      req.body = {};
      await createTask(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Task title is required',
      });
    });

    it('should return 404 if organization not found', async () => {
      req.params = { organizationId: 'orgId' };
      req.body = {
        title: 'New Task',
        priority: 'HIGH',
        dueDate: new Date().toISOString(),
      };
      prisma.organization.findFirst.mockResolvedValue(null);
      await createTask(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return 403 if user does not have permission', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
      };
      req.body = {
        title: 'New Task',
        priority: 'HIGH',
        dueDate: new Date().toISOString(),
      };
      req.user = { id: 'otherUser', role: 'USER' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [],
      });
      prisma.team.findFirst.mockResolvedValue({
        id: 'teamId',
        createdBy: 'anotherUser',
      });
      prisma.project.findFirst.mockResolvedValue({
        id: 'projectId',
        createdBy: 'anotherUser',
      });

      await createTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to create this task',
      });
    });
  });

  describe('updateTask', () => {
    it('should update a task successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      req.body = { title: 'Updated Task' };
      req.user = { id: 'userId', role: 'ADMIN' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [{ userId: 'userId' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue({
        id: 'taskId',
        title: 'Old Task',
      });
      prisma.task.update.mockResolvedValue({ id: 'taskId', ...req.body });

      await updateTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Task updated successfully',
        }),
      );
      expect(createActivityLog).toHaveBeenCalled();
    });

    it('should return 400 for validation error', async () => {
      req.body = { title: '' }; // Invalid title
      await updateTask(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Task title cannot be empty',
      });
    });

    it('should return 404 if task not found', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      req.body = { title: 'Updated Task' };

      prisma.organization.findFirst.mockResolvedValue({ id: 'orgId' });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue(null);

      await updateTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    });

    it('should return 403 if user does not have permission', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      req.body = { title: 'Updated Task' };
      req.user = { id: 'otherUser', role: 'USER' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [],
      });
      prisma.team.findFirst.mockResolvedValue({
        id: 'teamId',
        createdBy: 'anotherUser',
      });
      prisma.project.findFirst.mockResolvedValue({
        id: 'projectId',
        createdBy: 'anotherUser',
      });
      prisma.task.findFirst.mockResolvedValue({
        id: 'taskId',
        title: 'Old Task',
      });

      await updateTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to update this task',
      });
    });

    it('should return 400 for circular dependency', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId1',
      };
      req.body = { parentId: 'taskId1' };
      req.user = { id: 'userId', role: 'ADMIN' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [{ userId: 'userId' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue({
        id: 'taskId1',
        parentId: 'taskId2',
      });

      await updateTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Parent task ID must be a valid UUID',
      });
    });
  });

  describe('updateTaskPriority', () => {
    it('should update task priority successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      req.body = { priority: 'HIGH' };
      req.user = { id: 'userId', role: 'ADMIN' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [{ userId: 'userId' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue({
        id: 'taskId',
        priority: 'LOW',
      });
      prisma.task.update.mockResolvedValue({ id: 'taskId', priority: 'HIGH' });

      await updateTaskPriority(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Task priority updated successfully',
        }),
      );
    });

    it('should return 400 for invalid priority', async () => {
      req.body = { priority: 'INVALID' };
      await updateTaskPriority(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid priority (HIGH, MEDIUM, LOW) is required',
      });
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      req.body = { status: 'IN_PROGRESS' };
      req.user = { id: 'userId', role: 'ADMIN' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [{ userId: 'userId' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue({ id: 'taskId', status: 'TODO' });
      prisma.task.update.mockResolvedValue({
        id: 'taskId',
        status: 'IN_PROGRESS',
      });

      await updateTaskStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Task status updated successfully',
        }),
      );
    });

    it('should return 400 for invalid status', async () => {
      req.body = { status: 'INVALID' };
      await updateTaskStatus(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid status (TODO, IN_PROGRESS, REVIEW, DONE) is required',
      });
    });
  });

  describe('getAllTasks', () => {
    it('should get all tasks successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
      };
      const tasks = [{ id: 'taskId1' }, { id: 'taskId2' }];
      prisma.organization.findFirst.mockResolvedValue({ id: 'orgId' });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.count.mockResolvedValue(tasks.length);
      prisma.task.findMany.mockResolvedValue(tasks);

      await getAllTasks(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          tasks,
        }),
      );
    });
  });

  describe('getSpecificTask', () => {
    it('should get a specific task successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      const task = { id: 'taskId' };
      prisma.organization.findFirst.mockResolvedValue({ id: 'orgId' });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue(task);

      await getSpecificTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        task,
      });
    });

    it('should return 404 if task not found', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      prisma.organization.findFirst.mockResolvedValue({ id: 'orgId' });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue(null);

      await getSpecificTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Task not found or does not belong to the specified project',
      });
    });
  });

  describe('deleteTask', () => {
    it('should soft delete a task successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      req.user = { id: 'userId', role: 'ADMIN' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [{ userId: 'userId' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue({ id: 'taskId', subtasks: [] });
      prisma.task.update.mockResolvedValue({
        id: 'taskId',
        deletedAt: new Date(),
      });

      await deleteTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Task deleted successfully',
      });
    });

    it('should permanently delete a task successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      req.query = { permanent: 'true' };
      req.user = { id: 'userId', role: 'ADMIN' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [{ userId: 'userId' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue({ id: 'taskId', subtasks: [] });

      await deleteTask(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Task permanently deleted successfully',
      });
    });
  });

  describe('restoreTask', () => {
    it('should restore a task successfully', async () => {
      req.params = {
        organizationId: 'orgId',
        teamId: 'teamId',
        projectId: 'projectId',
        taskId: 'taskId',
      };
      req.user = { id: 'userId', role: 'ADMIN' };

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        owners: [{ userId: 'userId' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
      prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
      prisma.task.findFirst.mockResolvedValue({
        id: 'taskId',
        deletedAt: new Date(),
        subtasks: [],
        parent: null,
      });
      prisma.task.update.mockResolvedValue({ id: 'taskId', deletedAt: null });
      prisma.task.findUnique.mockResolvedValue({
        id: 'taskId',
        deletedAt: null,
      });

      await restoreTask(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Task restored successfully with its subtasks',
        }),
      );
    });
  });

  describe('getTasksInSpecificOrg', () => {
    it('should get tasks in a specific org successfully', async () => {
      req.params = { organizationId: 'orgId' };
      req.user = { id: 'userId', role: 'ADMIN' };
      const tasks = [{ id: 'taskId1' }, { id: 'taskId2' }];

      prisma.organization.findFirst.mockResolvedValue({
        id: 'orgId',
        users: [{ id: 'userId' }],
      });
      prisma.task.findMany.mockResolvedValue(
        tasks.map((t) => ({ ...t, _count: { subtasks: 0 }, subtasks: [] })),
      );
      prisma.task.count.mockResolvedValue(tasks.length);

      await getTasksInSpecificOrg(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Organization's tasks retrieved successfully",
        }),
      );
    });
  });
});
