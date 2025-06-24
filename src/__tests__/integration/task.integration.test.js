import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import request from 'supertest';
import { app } from '../../index.js';
import prisma from '../../config/prismaClient.js';
import { hashPassword } from '../../utils/password.utils.js';
import { generateAccessToken } from '../../utils/token.utils.js';

jest.setTimeout(30000);

describe('Task Controller Integration', () => {
  let server;
  let adminUser, memberUser, outsiderUser;
  let adminToken, memberToken, outsiderToken;
  let organization, team, project, sprint;
  let task; /* eslint-disable-line */

  beforeAll(async () => {
    server = app.listen(4012);
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean DB
    await prisma.taskAttachment.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.taskDependency.deleteMany({});
    await prisma.timelog.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.sprint.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.teamMember.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.organizationOwner.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});

    // Create users
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@task.com',
        password: await hashPassword('Password123!'),
        firstName: 'Admin',
        lastName: 'Task',
        username: 'admintask',
        role: 'ADMIN',
        isActive: true,
      },
    });
    memberUser = await prisma.user.create({
      data: {
        email: 'member@task.com',
        password: await hashPassword('Password123!'),
        firstName: 'Member',
        lastName: 'Task',
        username: 'membertask',
        role: 'MEMBER',
        isActive: true,
      },
    });
    outsiderUser = await prisma.user.create({
      data: {
        email: 'outsider@task.com',
        password: await hashPassword('Password123!'),
        firstName: 'Out',
        lastName: 'Sider',
        username: 'outsidertask',
        role: 'MEMBER',
        isActive: true,
      },
    });
    adminToken = generateAccessToken(adminUser);
    memberToken = generateAccessToken(memberUser);
    outsiderToken = generateAccessToken(outsiderUser);

    // Create org, team, project
    organization = await prisma.organization.create({
      data: {
        name: 'TaskOrg',
        industry: 'Tech',
        sizeRange: '1-10',
        createdBy: adminUser.id,
        joinCode: 'TASKCODE',
        isVerified: true,
        status: 'APPROVED',
        contactEmail: 'contact@taskorg.com',
        users: { connect: [{ id: adminUser.id }, { id: memberUser.id }] },
      },
    });
    await prisma.organizationOwner.create({
      data: { organizationId: organization.id, userId: adminUser.id },
    });
    team = await prisma.team.create({
      data: {
        name: 'Task Team',
        description: 'Handles tasks',
        createdBy: adminUser.id,
        organizationId: organization.id,
      },
    });
    await prisma.teamMember.createMany({
      data: [
        { teamId: team.id, userId: adminUser.id, role: 'LEADER' },
        { teamId: team.id, userId: memberUser.id, role: 'MEMBER' },
      ],
    });
    project = await prisma.project.create({
      data: {
        name: 'Task Project',
        organizationId: organization.id,
        teamId: team.id,
        createdBy: adminUser.id,
        lastModifiedBy: adminUser.id,
        startDate: new Date('2024-01-01T00:00:00.000Z'),
        endDate: new Date('2024-12-31T00:00:00.000Z'),
        status: 'PLANNING',
      },
    });
    await prisma.projectMember.createMany({
      data: [
        {
          projectId: project.id,
          userId: adminUser.id,
          role: 'PROJECT_OWNER',
          isActive: true,
        },
        {
          projectId: project.id,
          userId: memberUser.id,
          role: 'DEVELOPER',
          isActive: true,
        },
      ],
    });
    sprint = await prisma.sprint.create({
      data: {
        name: 'Sprint 1',
        projectId: project.id,
        startDate: new Date('2024-02-01T00:00:00.000Z'),
        endDate: new Date('2024-02-28T00:00:00.000Z'),
        status: 'PLANNING',
        goal: 'Goal',
        order: 0,
      },
    });
  });

  describe('POST /api/organization/:organizationId/team/:teamId/project/:projectId/task/create', () => {
    it('should create a new task (201)', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'A test task',
        priority: 'HIGH',
        dueDate: '2024-03-01T00:00:00.000Z',
        sprintId: sprint.id,
        assignedTo: memberUser.id,
        estimatedTime: 5,
        labels: ['feature', 'urgent'],
      };
      const res = await request(server)
        .post(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/create`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send(taskData);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.task.title).toBe(taskData.title);
      task = res.body.task;
    });
    it('should fail with missing required fields (400)', async () => {
      const res = await request(server)
        .post(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/create`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBeDefined();
    });
    it('should fail if assignedTo is not a project member (400)', async () => {
      const outsider = await prisma.user.create({
        data: {
          email: 'notmember@task.com',
          password: await hashPassword('Password123!'),
          firstName: 'Not',
          lastName: 'Member',
          username: 'notmember',
          role: 'MEMBER',
          isActive: true,
        },
      });
      const taskData = {
        title: 'Invalid Assignment',
        priority: 'LOW',
        dueDate: '2024-03-01T00:00:00.000Z',
        assignedTo: outsider.id,
      };
      const res = await request(server)
        .post(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/create`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send(taskData);
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/not a member/);
    });
    it('should fail for unauthorized user (403)', async () => {
      const taskData = {
        title: 'Unauthorized',
        priority: 'MEDIUM',
        dueDate: '2024-03-01T00:00:00.000Z',
      };
      const res = await request(server)
        .post(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/create`,
        )
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send(taskData);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId', () => {
    it('should update a task (200)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'To Update',
          priority: 'MEDIUM',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const updateData = {
        title: 'Updated Task',
        description: 'Updated desc',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
      };
      const res = await request(server)
        .put(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      expect(res.statusCode).toBe(200);
      expect(res.body.task.title).toBe(updateData.title);
      expect(res.body.task.status).toBe(updateData.status);
    });
    it('should fail for non-existent task (404)', async () => {
      const nonExistentId = '11111111-1111-1111-1111-111111111111';
      const res = await request(server)
        .put(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${nonExistentId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Nope' });
      expect(res.statusCode).toBe(404);
    });
    it('should fail for unauthorized user (403)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'No Perm',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .put(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}`,
        )
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'No Perm' });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/priority', () => {
    it('should update task priority (200)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'Priority Task',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .patch(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}/priority`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'HIGH' });
      expect(res.statusCode).toBe(200);
      expect(res.body.task.priority).toBe('HIGH');
    });
    it('should fail for invalid priority (400)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'Invalid Priority',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .patch(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}/priority`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'INVALID' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/status', () => {
    it('should update task status (200)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'Status Task',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .patch(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}/status`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DONE' });
      expect(res.statusCode).toBe(200);
      expect(res.body.task.status).toBe('DONE');
    });
    it('should fail for invalid status (400)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'Invalid Status',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .patch(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}/status`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/organization/:organizationId/team/:teamId/project/:projectId/task/all', () => {
    it('should get all tasks (200)', async () => {
      await prisma.task.create({
        data: {
          title: 'Task 1',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      await prisma.task.create({
        data: {
          title: 'Task 2',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-02T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .get(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/all`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.tasks)).toBe(true);
      expect(res.body.tasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId', () => {
    it('should get a specific task (200)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'Specific Task',
          priority: 'MEDIUM',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .get(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.task.title).toBe('Specific Task');
    });
    it('should return 404 for non-existent task', async () => {
      const nonExistentId = '11111111-1111-1111-1111-111111111111';
      const res = await request(server)
        .get(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${nonExistentId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/delete', () => {
    it('should soft delete a task (200)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'To Delete',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .delete(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}/delete`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/deleted successfully/);
      const dbTask = await prisma.task.findUnique({
        where: { id: created.id },
      });
      expect(dbTask.deletedAt).not.toBeNull();
    });
    it('should permanently delete a task (200) for admin', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'Perm Delete',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .delete(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}/delete?permanent=true`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      const dbTask = await prisma.task.findUnique({
        where: { id: created.id },
      });
      expect(dbTask).toBeNull();
    });
    it('should fail permanent delete for non-admin (403)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'Perm Deny',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .delete(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}/delete?permanent=true`,
        )
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/organization/:organizationId/team/:teamId/project/:projectId/task/:taskId/restore', () => {
    it('should restore a soft-deleted task (200)', async () => {
      const created = await prisma.task.create({
        data: {
          title: 'Restore Me',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
          deletedAt: new Date(),
        },
      });
      const res = await request(server)
        .patch(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${created.id}/restore`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ restoreSubtasks: false });
      expect(res.statusCode).toBe(200);
      expect(res.body.task.deletedAt).toBeNull();
    });
    it('should fail to restore if parent is deleted (400)', async () => {
      const parent = await prisma.task.create({
        data: {
          title: 'Parent',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
          deletedAt: new Date(),
        },
      });
      const child = await prisma.task.create({
        data: {
          title: 'Child',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
          parentId: parent.id,
          deletedAt: new Date(),
        },
      });
      const res = await request(server)
        .patch(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/task/${child.id}/restore`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ restoreSubtasks: false });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/organization/:organizationId/tasks', () => {
    it('should get all tasks in org (200)', async () => {
      await prisma.task.create({
        data: {
          title: 'Org Task',
          priority: 'HIGH',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .get(`/api/organization/${organization.id}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.tasks)).toBe(true);
      expect(res.body.data.tasks.length).toBeGreaterThanOrEqual(1);
    });
    it('should filter by assignedTo', async () => {
      const t = await prisma.task.create({
        data: {
          title: 'Assigned',
          priority: 'HIGH',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          assignedTo: memberUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .get(
          `/api/organization/${organization.id}/tasks?assignedTo=${memberUser.id}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.tasks.some((task) => task.id === t.id)).toBe(true);
    });
    it('should filter by status', async () => {
      const t = await prisma.task.create({
        data: {
          title: 'Done Task',
          priority: 'HIGH',
          status: 'DONE',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .get(`/api/organization/${organization.id}/tasks?status=DONE`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.tasks.some((task) => task.id === t.id)).toBe(true);
    });
    it('should filter by priority', async () => {
      const t = await prisma.task.create({
        data: {
          title: 'Low Priority',
          priority: 'LOW',
          status: 'TODO',
          projectId: project.id,
          createdBy: adminUser.id,
          dueDate: new Date('2024-03-01T00:00:00.000Z'),
        },
      });
      const res = await request(server)
        .get(`/api/organization/${organization.id}/tasks?priority=LOW`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.tasks.some((task) => task.id === t.id)).toBe(true);
    });
  });
});
