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
import crypto from 'crypto';
import { app } from '../../index.js';
import prisma from '../../config/prismaClient.js';
import { hashPassword } from '../../utils/password.utils.js';
import { generateAccessToken } from '../../utils/token.utils.js';
import { hashOTP } from '../../utils/otp.utils.js';

jest.setTimeout(20000); // Set global timeout for all tests in this file

describe('Organization Endpoints', () => {
  let server;
  let testUser;
  let accessToken;

  beforeAll((done) => {
    server = app.listen(4002, done); // Use another port
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    // Clean the database
    await prisma.organizationOwner.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});

    // Create a test user
    testUser = await prisma.user.create({
      data: {
        email: 'org.test@example.com',
        password: await hashPassword('Password123!'),
        firstName: 'Org',
        lastName: 'Test',
        username: 'orgtest',
        role: 'ADMIN',
        isActive: true,
      },
    });

    // Generate token for the user
    accessToken = generateAccessToken(testUser);
  });

  describe('POST /api/organization', () => {
    it('should create a new organization and return 201', async () => {
      const orgData = {
        name: 'Test Organization',
        description: 'A test organization.',
        industry: 'Technology',
        contactEmail: 'contact@testorg.com',
        sizeRange: '1-10',
      };

      const res = await request(server)
        .post('/api/organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(orgData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data.organization).toHaveProperty('name', orgData.name);

      const dbOrg = await prisma.organization.findFirst({
        where: { name: orgData.name },
      });
      expect(dbOrg).not.toBeNull();

      const ownerLink = await prisma.organizationOwner.findFirst({
        where: { organizationId: dbOrg.id, userId: testUser.id },
      });
      expect(ownerLink).not.toBeNull();
    });

    it('should not create an organization with a duplicate name and return 409', async () => {
      const orgData = {
        name: 'Duplicate Organization',
        description: 'A test organization.',
        industry: 'Technology',
        contactEmail: 'contact@duplicate.com',
        sizeRange: '1-10',
      };

      // Create the organization first
      await prisma.organization.create({
        data: {
          ...orgData,
          createdBy: testUser.id,
          joinCode: 'ABCDEFGH',
          isVerified: true,
          status: 'APPROVED',
        },
      });

      const res = await request(server)
        .post('/api/organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...orgData, contactEmail: 'new-contact@duplicate.com' });

      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty(
        'message',
        'Organization with this name or email already exists',
      );
    });

    it('should return 400 for invalid data', async () => {
      const orgData = {
        description: 'A test organization.',
        industry: 'Technology',
      };

      const res = await request(server)
        .post('/api/organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(orgData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/organization/all', () => {
    it('should return a list of organizations for an authenticated user', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Org 1',
          industry: 'Tech',
          sizeRange: '1-10',
          createdBy: testUser.id,
          joinCode: 'JOINME1',
          isVerified: true,
          status: 'APPROVED',
        },
      });

      // Make the user an owner of the organization
      await prisma.organizationOwner.create({
        data: {
          organizationId: org.id,
          userId: testUser.id,
        },
      });

      const res = await request(server)
        .get('/api/organization/all')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.organizations.length).toBe(1);
      expect(res.body.data.organizations[0].name).toBe('Org 1');
    });
  });

  describe('GET /api/organization/:organizationId', () => {
    let organization;
    beforeEach(async () => {
      organization = await prisma.organization.create({
        data: {
          name: 'Specific Org',
          industry: 'Finance',
          sizeRange: '11-50',
          createdBy: testUser.id,
          joinCode: 'JOINME2',
          isVerified: true,
          status: 'APPROVED',
        },
      });

      await prisma.user.update({
        where: { id: testUser.id },
        data: { organizationId: organization.id },
      });
    });

    it('should return the specific organization for a member', async () => {
      const res = await request(server)
        .get(`/api/organization/${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.name).toBe('Specific Org');
    });

    it('should return 404 for a non-existent organization', async () => {
      const nonExistentId = crypto.randomUUID();
      const res = await request(server)
        .get(`/api/organization/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should return 403 if user is not a member of the organization', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: await hashPassword('Password123!'),
          firstName: 'Other',
          lastName: 'User',
          username: 'otheruser',
          role: 'MEMBER',
          isActive: true,
        },
      });
      const otherToken = generateAccessToken(otherUser);

      const res = await request(server)
        .get(`/api/organization/${organization.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('PUT /api/organization/:organizationId', () => {
    let organization;
    beforeEach(async () => {
      organization = await prisma.organization.create({
        data: {
          name: 'Update Org',
          industry: 'Healthcare',
          sizeRange: '51-200',
          createdBy: testUser.id,
          joinCode: 'JOINME3',
          isVerified: true,
          status: 'APPROVED',
        },
      });
    });

    it('should update the organization and return 200', async () => {
      const updateData = { name: 'Updated Org Name' };
      const res = await request(server)
        .put(`/api/organization/${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.name).toBe('Updated Org Name');
    });
  });

  describe('DELETE /api/organization/:organizationId', () => {
    let organization;
    beforeEach(async () => {
      organization = await prisma.organization.create({
        data: {
          name: 'Delete Org',
          industry: 'Retail',
          sizeRange: '201-500',
          createdBy: testUser.id,
          joinCode: 'JOINME4',
          isVerified: true,
          status: 'APPROVED',
        },
      });
    });

    it('should soft delete the organization and return 200', async () => {
      const res = await request(server)
        .delete(`/api/organization/${organization.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);

      const deletedOrg = await prisma.organization.findUnique({
        where: { id: organization.id },
      });
      expect(deletedOrg.deletedAt).not.toBeNull();
    });
  });

  describe('User-Organization Membership', () => {
    it('should allow a user to join an organization with a valid code', async () => {
      // Create a user to own the organization
      const ownerUser = await prisma.user.create({
        data: {
          email: 'owner.join@example.com',
          password: await hashPassword('Password123!'),
          firstName: 'Owner',
          lastName: 'Join',
          username: 'ownerjoin',
          role: 'ADMIN',
          isActive: true,
        },
      });
      const ownerToken = generateAccessToken(ownerUser);

      // Create an organization using the API endpoint
      const orgResponse = await request(server)
        .post('/api/organization')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Joinable Org by API',
          industry: 'Education',
          sizeRange: '1-10',
          contactEmail: 'contact@joinable.com',
        });

      expect(orgResponse.statusCode).toBe(201);
      const { joinCode } = orgResponse.body.data.organization;

      // Create a user who will join the organization (do NOT set organizationId)
      const joiningUser = await prisma.user.create({
        data: {
          email: 'joiner@example.com',
          password: await hashPassword('password'),
          firstName: 'Join',
          lastName: 'Er',
          username: 'joiner',
          role: 'MEMBER',
          isActive: true,
          // organizationId: undefined, // Do NOT set
        },
      });
      const joiningToken = generateAccessToken(joiningUser);

      // Join the organization
      const res = await request(server)
        .post('/api/organization/join')
        .set('Authorization', `Bearer ${joiningToken}`)
        .send({ joinCode });

      expect(res.statusCode).toEqual(200);
      const updatedUser = await prisma.user.findUnique({
        where: { id: joiningUser.id },
      });
      expect(updatedUser.organizationId).toBe(
        orgResponse.body.data.organization.id,
      );
    });

    it('should return 404 for an invalid join code', async () => {
      const res = await request(server)
        .post('/api/organization/join')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ joinCode: 'INVALIDCODE' });
      expect(res.statusCode).toEqual(404);
    });

    it('should return hasOrganization: false for a user not in an org', async () => {
      const userWithoutOrg = await prisma.user.create({
        data: {
          email: 'no-org@example.com',
          password: await hashPassword('password'),
          firstName: 'No',
          lastName: 'Org',
          username: 'noorg',
          role: 'MEMBER',
          isActive: true,
        },
      });
      const noOrgToken = generateAccessToken(userWithoutOrg);

      const res = await request(server)
        .get('/api/organization/status')
        .set('Authorization', `Bearer ${noOrgToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.hasOrganization).toBe(false);
    });

    it('should return hasOrganization: true for a user in an org', async () => {
      // Create a user and an organization for them, making them the owner
      const userInOrg = await prisma.user.create({
        data: {
          email: 'in-org@example.com',
          password: await hashPassword('password'),
          firstName: 'In',
          lastName: 'Org',
          username: 'inorg',
          role: 'MEMBER',
          isActive: true,
        },
      });
      const inOrgToken = generateAccessToken(userInOrg);

      const orgResponse = await request(server)
        .post('/api/organization')
        .set('Authorization', `Bearer ${inOrgToken}`)
        .send({
          name: 'Member Org API',
          industry: 'Tech',
          sizeRange: '1-10',
          contactEmail: 'contact@memberorg.com',
        });
      expect(orgResponse.statusCode).toBe(201);

      const res = await request(server)
        .get('/api/organization/status')
        .set('Authorization', `Bearer ${inOrgToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.hasOrganization).toBe(true);
      expect(res.body.organization.id).toBe(
        orgResponse.body.data.organization.id,
      );
    });
  });

  describe('POST /api/organization/:organizationId/owners', () => {
    it('should allow an admin to add a new owner', async () => {
      const orgResponse = await request(server)
        .post('/api/organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Org With Owners API',
          industry: 'Consulting',
          sizeRange: '1-10',
          contactEmail: 'contact@ownerorg.com',
        });
      expect(orgResponse.statusCode).toBe(201);
      const { id: organizationId } = orgResponse.body.data.organization;

      // Create the new owner user (do NOT set organizationId)
      const newOwner = await prisma.user.create({
        data: {
          email: 'newowner@example.com',
          password: await hashPassword('password'),
          firstName: 'New',
          lastName: 'Owner',
          username: 'newowner',
          role: 'MEMBER',
          isActive: true,
          // organizationId: organizationId, // Do NOT set
        },
      });

      const res = await request(server)
        .post(`/api/organization/${organizationId}/addOwner`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userIds: [newOwner.id] });

      expect(res.statusCode).toEqual(200);
      const ownerLink = await prisma.organizationOwner.findFirst({
        where: { organizationId: organizationId, userId: newOwner.id },
      });
      expect(ownerLink).not.toBeNull();
    });
  });

  describe('POST /api/organization/verify', () => {
    it('should verify the organization with the correct OTP', async () => {
      const unverifiedUser = await prisma.user.create({
        data: {
          email: 'unverified@example.com',
          password: await hashPassword('password'),
          firstName: 'Unverified',
          lastName: 'User',
          username: 'unverifieduser',
          role: 'ADMIN',
          isActive: true,
        },
      });
      const unverifiedToken = generateAccessToken(unverifiedUser);

      // The controller currently auto-verifies, so we'll simulate an unverified state
      // by creating it and then updating it to be unverified.
      const orgResponse = await request(server)
        .post('/api/organization')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({
          name: 'Unverified Org API',
          industry: 'Non-Profit',
          sizeRange: '1-10',
          contactEmail: 'unverified@org.com',
        });
      expect(orgResponse.statusCode).toBe(201);
      const { id: orgId } = orgResponse.body.data.organization;

      const otp = '123456';
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          isVerified: false,
          status: 'PENDING',
          emailVerificationOTP: await hashOTP(otp),
          emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
        },
      });

      const res = await request(server)
        .post(`/api/organization/verifyOrg/${orgId}`)
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .send({ otp: otp });

      expect(res.statusCode).toEqual(200);
      const verifiedOrg = await prisma.organization.findUnique({
        where: { id: orgId },
      });
      expect(verifiedOrg.isVerified).toBe(true);
      expect(verifiedOrg.status).toBe('APPROVAL');
    });
  });
});
