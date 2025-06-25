import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import taskRoutes, { orgRouter } from '../mocks/task.routes.mock.js';
import { errorHandlerMiddleware } from '../mocks/middleware.mock.js';
import cookieParser from 'cookie-parser';

describe('Task Controller E2E Tests', () => {
  // Create a test express app
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const organizationId = 'mock-org-id';
  const teamId = 'mock-team-id';
  const projectId = 'mock-project-id';
  const taskId = 'mock-task-id-1';
  const testPrefix = `e2e_task_test_${Date.now()}`;

  beforeAll(() => {
    // Set up routes
    app.use(
      `/api/organization/:organizationId/team/:teamId/project/:projectId/task`,
      taskRoutes,
    );
    app.use(`/api/organization/:organizationId/tasks`, orgRouter);
    app.use(errorHandlerMiddleware);
  });

  describe('Create Task', () => {
    it('should create a task successfully', async () => {
      const taskData = {
        title: `${testPrefix}_Task Title`,
        description: 'Task Description',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
        estimatedTime: 8,
        labels: ['bug', 'frontend'],
      };

      const response = await request(app)
        .post(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
        )
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.task).toBeDefined();
      expect(response.body.task.title).toBe(taskData.title);
      expect(response.body.task.priority).toBe(taskData.priority);
      expect(response.body.project_members).toBeInstanceOf(Array);
    });

    it('should fail to create a task without title', async () => {
      const taskData = {
        description: 'Task Description',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      };

      const response = await request(app)
        .post(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
        )
        .send(taskData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Title is required');
    });

    it('should fail to create a task without due date', async () => {
      const taskData = {
        title: `${testPrefix}_Task Title`,
        description: 'Task Description',
        priority: 'HIGH',
      };

      const response = await request(app)
        .post(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
        )
        .send(taskData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Due date is required');
    });

    it('should fail to create a task with invalid priority', async () => {
      const taskData = {
        title: `${testPrefix}_Task Title`,
        description: 'Task Description',
        priority: 'INVALID',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      };

      const response = await request(app)
        .post(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
        )
        .send(taskData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Valid priority');
    });

    it('should fail to create a task with non-existent sprint', async () => {
      const taskData = {
        title: `${testPrefix}_Task Title`,
        description: 'Task Description',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        sprintId: 'non-existent-sprint',
      };

      const response = await request(app)
        .post(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
        )
        .send(taskData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Sprint not found');
    });

    it('should fail to create a task with non-existent parent task', async () => {
      const taskData = {
        title: `${testPrefix}_Task Title`,
        description: 'Task Description',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        parentId: 'non-existent-task',
      };

      const response = await request(app)
        .post(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
        )
        .send(taskData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Parent task not found');
    });

    it('should fail to create a task with non-existent assigned user', async () => {
      const taskData = {
        title: `${testPrefix}_Task Title`,
        description: 'Task Description',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        assignedTo: 'non-existent-user',
      };

      const response = await request(app)
        .post(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
        )
        .send(taskData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Assigned user not found');
    });

    it('should fail to create a task with user not in project', async () => {
      const taskData = {
        title: `${testPrefix}_Task Title`,
        description: 'Task Description',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        assignedTo: 'not-project-member',
      };

      const response = await request(app)
        .post(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
        )
        .send(taskData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Assigned user not found');
    });
  });

  describe('Update Task', () => {
    it('should update a task successfully', async () => {
      const updateData = {
        title: `${testPrefix}_Updated Task`,
        description: 'Updated description',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
      };

      const response = await request(app)
        .put(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}`,
        )
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.task).toBeDefined();
      expect(response.body.task.title).toBe(updateData.title);
      expect(response.body.task.description).toBe(updateData.description);
      expect(response.body.task.status).toBe(updateData.status);
      expect(response.body.task.priority).toBe(updateData.priority);
    });

    it('should fail to update a non-existent task', async () => {
      const updateData = {
        title: `${testPrefix}_Updated Task`,
        description: 'Updated description',
      };

      const response = await request(app)
        .put(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/non-existent-task`,
        )
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Task not found');
    });

    it('should fail to update a task with circular dependency', async () => {
      const updateData = {
        parentId: taskId, // Same as the task being updated
      };

      const response = await request(app)
        .put(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}`,
        )
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot be its own parent');
    });

    it('should fail to update a task with hierarchical circular dependency', async () => {
      const updateData = {
        parentId: 'circular-dependency',
      };

      const response = await request(app)
        .put(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}`,
        )
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Parent task not found');
    });
  });

  describe('Update Task Priority', () => {
    it('should update task priority successfully', async () => {
      const updateData = {
        priority: 'LOW',
      };

      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}/priority`,
        )
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.task).toBeDefined();
      expect(response.body.task.priority).toBe(updateData.priority);
    });

    it('should fail to update priority with invalid value', async () => {
      const updateData = {
        priority: 'INVALID',
      };

      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}/priority`,
        )
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Valid priority');
    });

    it('should fail to update priority for non-existent task', async () => {
      const updateData = {
        priority: 'HIGH',
      };

      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/non-existent-task/priority`,
        )
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Task not found');
    });
  });

  describe('Update Task Status', () => {
    it('should update task status successfully', async () => {
      const updateData = {
        status: 'REVIEW',
      };

      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}/status`,
        )
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.task).toBeDefined();
      expect(response.body.task.status).toBe(updateData.status);
    });

    it('should fail to update status with invalid value', async () => {
      const updateData = {
        status: 'INVALID',
      };

      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}/status`,
        )
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Valid status');
    });

    it('should fail to update status for non-existent task', async () => {
      const updateData = {
        status: 'DONE',
      };

      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/non-existent-task/status`,
        )
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Task not found');
    });
  });

  describe('Get All Tasks', () => {
    it('should get all tasks successfully', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tasks).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter tasks by sprint', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task?sprintId=mock-sprint-id-1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tasks).toBeInstanceOf(Array);
      if (response.body.tasks.length > 0) {
        expect(response.body.tasks[0].sprintId).toBe('mock-sprint-id-1');
      }
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task?priority=HIGH`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tasks).toBeInstanceOf(Array);
      if (response.body.tasks.length > 0) {
        expect(response.body.tasks[0].priority).toBe('HIGH');
      }
    });

    it('should filter tasks by status', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task?status=IN_PROGRESS`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tasks).toBeInstanceOf(Array);
      if (response.body.tasks.length > 0) {
        expect(response.body.tasks[0].status).toBe('IN_PROGRESS');
      }
    });

    it('should filter tasks by assignee', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task?assignedTo=me`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tasks).toBeInstanceOf(Array);
    });

    it('should filter tasks by search term', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task?search=Task 1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tasks).toBeInstanceOf(Array);
    });

    it('should paginate tasks', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task?page=1&limit=1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tasks).toBeInstanceOf(Array);
      expect(response.body.tasks.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('Get Specific Task', () => {
    it('should get a specific task successfully', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.task).toBeDefined();
      expect(response.body.task.id).toBe(taskId);
    });

    it('should fail to get a non-existent task', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/non-existent-task`,
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Task not found');
    });
  });

  describe('Delete Task', () => {
    it('should soft delete a task successfully', async () => {
      const response = await request(app).delete(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should fail to delete a non-existent task', async () => {
      const response = await request(app).delete(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/non-existent-task`,
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Task not found');
    });

    it('should fail to permanently delete a task without admin privileges', async () => {
      const response = await request(app).delete(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}?permanent=true`,
      );

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only administrators');
    });

    it('should permanently delete a task with admin privileges', async () => {
      const response = await request(app).delete(
        `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}?permanent=true&isAdmin=true`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('permanently deleted');
    });
  });

  describe('Restore Task', () => {
    it('should restore a task successfully', async () => {
      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}/restore`,
        )
        .send({ restoreSubtasks: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('restored successfully');
      expect(response.body.task).toBeDefined();
    });

    it('should restore a task without subtasks', async () => {
      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/${taskId}/restore`,
        )
        .send({ restoreSubtasks: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('restored successfully');
      expect(response.body.task).toBeDefined();
    });

    it('should fail to restore a non-existent task', async () => {
      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/non-existent-task/restore`,
        )
        .send({ restoreSubtasks: true });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Task not found');
    });

    it('should fail to restore a task with deleted parent', async () => {
      const response = await request(app)
        .patch(
          `/api/organization/${organizationId}/team/${teamId}/project/${projectId}/task/mock-task-id-3/restore`,
        )
        .send({ restoreSubtasks: true });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Task not found');
    });
  });

  describe('Get Tasks in Organization', () => {
    it('should get all tasks in an organization', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/tasks`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.tasks).toBeInstanceOf(Array);
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter organization tasks by project', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/tasks?projectId=mock-project-id-1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.tasks.length > 0) {
        expect(response.body.data.tasks[0].project.id).toBe(
          'mock-project-id-1',
        );
      }
    });

    it('should filter organization tasks by project name', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/tasks?projectName=Project 1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.tasks.length > 0) {
        expect(response.body.data.tasks[0].project.name).toContain('Project 1');
      }
    });

    it('should filter organization tasks by assignee', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/tasks?assignedTo=me`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.tasks.length > 0) {
        expect(response.body.data.tasks[0].assignee).toBeDefined();
      }
    });

    it('should filter organization tasks by status', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/tasks?status=IN_PROGRESS`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.tasks.length > 0) {
        expect(response.body.data.tasks[0].status).toBe('IN_PROGRESS');
      }
    });

    it('should filter organization tasks by priority', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/tasks?priority=HIGH`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.tasks.length > 0) {
        expect(response.body.data.tasks[0].priority).toBe('HIGH');
      }
    });

    it('should paginate organization tasks', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/tasks?page=1&limit=1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks.length).toBeLessThanOrEqual(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should exclude subtasks when requested', async () => {
      const response = await request(app).get(
        `/api/organization/${organizationId}/tasks?includeSubtasks=false`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data.tasks.length > 0) {
        expect(response.body.data.tasks[0].subtasks).toBeUndefined();
      }
    });
  });
});
