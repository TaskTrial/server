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

jest.setTimeout(30000); // Set a global timeout for all tests in this file

describe('Department Endpoints', () => {
  let server;
  let testUser;
  let accessToken;
  let organization;
  let nonAdminUser;
  let nonAdminToken;

  beforeAll((done) => {
    server = app.listen(4003, done); // Use another port for departments
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    // Clean the database
    await prisma.department.deleteMany({});
    await prisma.organizationOwner.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});

    // Create a test user (Admin/Owner)
    testUser = await prisma.user.create({
      data: {
        email: 'dept.test@example.com',
        password: await hashPassword('Password123!'),
        firstName: 'Dept',
        lastName: 'Test',
        username: 'depttest',
        role: 'ADMIN',
        isActive: true,
      },
    });

    // Create a non-admin user
    nonAdminUser = await prisma.user.create({
      data: {
        email: 'nonadmin.dept@example.com',
        password: await hashPassword('Password123!'),
        firstName: 'Non',
        lastName: 'Admin',
        username: 'nonadmindept',
        role: 'MEMBER',
        isActive: true,
      },
    });

    // Generate tokens
    accessToken = generateAccessToken(testUser);
    nonAdminToken = generateAccessToken(nonAdminUser);

    // Create a test organization
    organization = await prisma.organization.create({
      data: {
        name: 'Test Corp for Departments',
        industry: 'Testing',
        sizeRange: '1-10',
        createdBy: testUser.id,
        joinCode: 'DEPTCODE',
        isVerified: true,
        status: 'APPROVED',
        contactEmail: 'contact@deptcorp.com',
      },
    });

    // Make the testUser an owner of the organization
    await prisma.organizationOwner.create({
      data: {
        organizationId: organization.id,
        userId: testUser.id,
      },
    });

    // Link users to the organization
    await prisma.user.update({
      where: { id: testUser.id },
      data: { organizationId: organization.id, isOwner: true },
    });
    await prisma.user.update({
      where: { id: nonAdminUser.id },
      data: { organizationId: organization.id },
    });
  });

  describe('POST /api/organizations/:organizationId/departments/create', () => {
    it('should create a new department and return 201', async () => {
      const deptData = {
        name: 'Engineering',
        description: 'The best engineering department.',
      };

      const res = await request(server)
        .post(`/api/organizations/${organization.id}/departments/create`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deptData);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(deptData.name);
      expect(res.body.data.managerId).toBe(testUser.id);

      const dbDept = await prisma.department.findFirst({
        where: { name: deptData.name },
      });
      expect(dbDept).not.toBeNull();
    });

    it('should not create a department with a duplicate name and return 409', async () => {
      const deptData = {
        name: 'Marketing',
        description: 'Handles marketing.',
      };
      // Create it once
      await request(server)
        .post(`/api/organizations/${organization.id}/departments/create`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deptData);

      // Try to create it again
      const res = await request(server)
        .post(`/api/organizations/${organization.id}/departments/create`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deptData);

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toBe(
        'Department name already exists in this organization',
      );
    });

    it('should return 403 if a non-admin/non-owner tries to create a department', async () => {
      const deptData = {
        name: 'HR',
        description: 'Human Resources',
      };
      const res = await request(server)
        .post(`/api/organizations/${organization.id}/departments/create`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send(deptData);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('GET /api/organizations/:organizationId/departments', () => {
    // it('should return a list of departments for the organization', async () => {
    //   await prisma.department.create({
    //     data: {
    //       name: 'Sales',
    //       organizationId: organization.id,
    //       managerId: testUser.id,
    //     },
    //   });
    //   const res = await request(server)
    //     .get(`/api/organizations/${organization.id}/departments`)
    //     .set('Authorization', `Bearer ${accessToken}`);
    //   expect(res.statusCode).toEqual(200);
    //   expect(res.body.data.departments.length).toBe(1);
    //   expect(res.body.data.departments[0].name).toBe('Sales');
    // });
  });

  describe('GET /api/organizations/:organizationId/departments/:departmentId', () => {
    it('should return a specific department', async () => {
      const department = await prisma.department.create({
        data: {
          name: 'Finance',
          organizationId: organization.id,
          managerId: testUser.id,
        },
      });

      const res = await request(server)
        .get(
          `/api/organizations/${organization.id}/departments/${department.id}`,
        )
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.name).toBe('Finance');
    });

    it('should return 404 for a non-existent department', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(server)
        .get(
          `/api/organizations/${organization.id}/departments/${nonExistentId}`,
        )
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('PUT /api/organizations/:organizationId/departments/:departmentId', () => {
    it('should update the department and return 200', async () => {
      const department = await prisma.department.create({
        data: {
          name: 'Customer Support',
          organizationId: organization.id,
          managerId: testUser.id,
        },
      });

      const updateData = { name: 'Customer Success' };

      const res = await request(server)
        .put(
          `/api/organizations/${organization.id}/departments/${department.id}`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.name).toBe('Customer Success');
    });
  });

  describe('DELETE /api/organizations/:organizationId/departments/:departmentId', () => {
    // it('should soft delete the department and return 200', async () => {
    //   const department = await prisma.department.create({
    //     data: {
    //       name: 'Operations',
    //       organizationId: organization.id,
    //       managerId: testUser.id,
    //     },
    //   });
    //   const res = await request(server)
    //     .delete(
    //       `/api/organizations/${organization.id}/departments/${department.id}`,
    //     )
    //     .set('Authorization', `Bearer ${accessToken}`);
    //   expect(res.statusCode).toEqual(200);
    //   const deletedDept = await prisma.department.findUnique({
    //     where: { id: department.id },
    //   });
    //   expect(deletedDept.deletedAt).not.toBeNull();
    // });
  });

  describe('PATCH /api/organizations/:organizationId/departments/:departmentId/restore', () => {
    it('should restore a soft-deleted department and return 200', async () => {
      const department = await prisma.department.create({
        data: {
          name: 'Archived Dept',
          organizationId: organization.id,
          managerId: testUser.id,
          deletedAt: new Date(),
        },
      });

      const res = await request(server)
        .patch(
          `/api/organizations/${organization.id}/departments/${department.id}/restore`,
        )
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);

      const restoredDept = await prisma.department.findUnique({
        where: { id: department.id },
      });
      expect(restoredDept.deletedAt).toBeNull();
    });
  });
});
