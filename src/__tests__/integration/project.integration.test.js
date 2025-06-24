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

describe('Project Controller Integration', () => {
  let server;
  let testUser;
  let accessToken;
  let organization;
  let team;
  let memberUser;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server = app.listen(4010, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.teamMember.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.organizationOwner.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'projadmin@example.com',
        password: await hashPassword('Password123!'),
        firstName: 'Proj',
        lastName: 'Admin',
        username: 'projadmin',
        role: 'ADMIN',
        isActive: true,
      },
    });
    accessToken = generateAccessToken(testUser);

    // Create another user
    memberUser = await prisma.user.create({
      data: {
        email: 'projmember@example.com',
        password: await hashPassword('Password123!'),
        firstName: 'Proj',
        lastName: 'Member',
        username: 'projmember',
        role: 'MEMBER',
        isActive: true,
      },
    });

    // Create organization
    organization = await prisma.organization.create({
      data: {
        name: 'ProjectOrg',
        industry: 'Tech',
        sizeRange: '1-10',
        createdBy: testUser.id,
        joinCode: 'PROJCODE',
        isVerified: true,
        status: 'APPROVED',
        contactEmail: 'contact@projectorg.com',
      },
    });
    await prisma.organizationOwner.create({
      data: { organizationId: organization.id, userId: testUser.id },
    });
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        users: { connect: [{ id: testUser.id }, { id: memberUser.id }] },
      },
    });

    // Create team
    team = await prisma.team.create({
      data: {
        name: 'Project Team',
        description: 'Handles projects',
        createdBy: testUser.id,
        organizationId: organization.id,
      },
    });
    await prisma.teamMember.createMany({
      data: [
        { teamId: team.id, userId: testUser.id, role: 'LEADER' },
        { teamId: team.id, userId: memberUser.id, role: 'MEMBER' },
      ],
    });
  });

  describe('POST /api/organization/:organizationId/team/:teamId/project', () => {
    it('should create a new project and return 201', async () => {
      const projectData = {
        name: 'Project Alpha',
        description: 'First project',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T00:00:00.000Z',
      };
      const res = await request(server)
        .post(`/api/organization/${organization.id}/team/${team.id}/project`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(projectData);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project.name).toBe(projectData.name);
    });
  });

  describe('GET /api/organization/:organizationId/team/:teamId/project/all', () => {
    it('should get all projects in a team', async () => {
      await prisma.project.create({
        data: {
          name: 'Test Project',
          organizationId: organization.id,
          teamId: team.id,
          createdBy: testUser.id,
          lastModifiedBy: testUser.id,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
          status: 'PLANNING',
        },
      });
      const res = await request(server)
        .get(`/api/organization/${organization.id}/team/${team.id}/project/all`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/organization/:organizationId/team/:teamId/project/:projectId', () => {
    it('should get a specific project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Specific Project',
          organizationId: organization.id,
          teamId: team.id,
          createdBy: testUser.id,
          lastModifiedBy: testUser.id,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
          status: 'PLANNING',
        },
      });
      const res = await request(server)
        .get(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}`,
        )
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Specific Project');
    });
  });

  describe('PUT /api/organization/:organizationId/team/:teamId/project/:projectId', () => {
    it('should update a project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Update Me',
          organizationId: organization.id,
          teamId: team.id,
          createdBy: testUser.id,
          lastModifiedBy: testUser.id,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
          status: 'PLANNING',
        },
      });
      const updateData = {
        name: 'Updated Name',
        description: 'Updated Description',
      };
      const res = await request(server)
        .put(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.description).toBe('Updated Description');
    });
  });

  describe('DELETE /api/organization/:organizationId/team/:teamId/project/:projectId/delete', () => {
    it('should soft delete a project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Delete Me',
          organizationId: organization.id,
          teamId: team.id,
          createdBy: testUser.id,
          lastModifiedBy: testUser.id,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
          status: 'PLANNING',
        },
      });
      const res = await request(server)
        .delete(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/delete`,
        )
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(dbProject.deletedAt).not.toBeNull();
    });
  });

  describe('PATCH /api/organization/:organizationId/team/:teamId/project/:projectId/restore', () => {
    it('should restore a soft-deleted project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Restore Me',
          organizationId: organization.id,
          teamId: team.id,
          createdBy: testUser.id,
          lastModifiedBy: testUser.id,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
          status: 'PLANNING',
          deletedAt: new Date(),
        },
      });
      const res = await request(server)
        .patch(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/restore`,
        )
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(dbProject.deletedAt).toBeNull();
    });
  });

  describe('POST /api/organization/:organizationId/team/:teamId/project/:projectId/addMember', () => {
    it('should add a member to the project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Add Member',
          organizationId: organization.id,
          teamId: team.id,
          createdBy: testUser.id,
          lastModifiedBy: testUser.id,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
          status: 'PLANNING',
        },
      });
      const res = await request(server)
        .post(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/addMember`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ members: [{ userId: memberUser.id, role: 'MEMBER' }] });
      expect([200, 201]).toContain(res.statusCode);
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId: project.id, userId: memberUser.id },
      });
      expect(projectMembers.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/organization/:organizationId/team/:teamId/project/:projectId/removeMember', () => {
    it('should remove a member from the project', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Remove Member',
          organizationId: organization.id,
          teamId: team.id,
          createdBy: testUser.id,
          lastModifiedBy: testUser.id,
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-12-31T00:00:00.000Z'),
          status: 'PLANNING',
        },
      });
      // Add member first
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: memberUser.id,
          role: 'MEMBER',
          isActive: true,
        },
      });
      const res = await request(server)
        .delete(
          `/api/organization/${organization.id}/team/${team.id}/project/${project.id}/removeMember`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId: memberUser.id });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const projectMember = await prisma.projectMember.findFirst({
        where: { projectId: project.id, userId: memberUser.id },
      });
      expect(projectMember.isActive).toBe(false);
      expect(projectMember.deletedAt).not.toBeNull();
    });
  });
});
