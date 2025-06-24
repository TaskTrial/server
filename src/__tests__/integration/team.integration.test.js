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

describe('Team Endpoints', () => {
  let server;
  let testUser;
  let accessToken;
  let organization;
  let nonAdminUser;
  let nonAdminToken;
  let memberUser;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server = app.listen(4004, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean the database
    await prisma.teamMember.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.organizationOwner.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});

    // Create a test user (Admin/Owner)
    testUser = await prisma.user.create({
      data: {
        email: 'team.test@example.com',
        password: await hashPassword('Password123!'),
        firstName: 'Team',
        lastName: 'Test',
        username: 'teamtest',
        role: 'ADMIN',
        isActive: true,
      },
    });

    // Create a non-admin user
    nonAdminUser = await prisma.user.create({
      data: {
        email: 'nonadmin.team@example.com',
        password: await hashPassword('Password123!'),
        firstName: 'NonAdmin',
        lastName: 'Team',
        username: 'nonadminteam',
        role: 'MEMBER',
        isActive: true,
      },
    });

    // Create another user to be a team member
    memberUser = await prisma.user.create({
      data: {
        email: 'member.team@example.com',
        password: await hashPassword('Password123!'),
        firstName: 'Member',
        lastName: 'Team',
        username: 'memberteam',
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
        name: 'Test Corp for Teams',
        industry: 'Testing',
        sizeRange: '1-10',
        createdBy: testUser.id,
        joinCode: 'TEAMCODE',
        isVerified: true,
        status: 'APPROVED',
        contactEmail: 'contact@teamcorp.com',
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
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        users: {
          connect: [
            { id: testUser.id },
            { id: nonAdminUser.id },
            { id: memberUser.id },
          ],
        },
      },
    });
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isOwner: true },
    });
  });

  describe('POST /api/organization/:organizationId/team', () => {
    it('should create a new team and return 201', async () => {
      const teamData = {
        name: 'Alpha Team',
        description: 'The first team.',
      };

      const res = await request(server)
        .post(`/api/organization/${organization.id}/team`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(teamData);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.team.name).toBe(teamData.name);
      expect(res.body.data.teamLeader.id).toBe(testUser.id);

      const dbTeam = await prisma.team.findFirst({
        where: { name: teamData.name },
      });
      expect(dbTeam).not.toBeNull();

      const teamLeader = await prisma.teamMember.findFirst({
        where: {
          teamId: dbTeam.id,
          userId: testUser.id,
        },
      });
      expect(teamLeader.role).toBe('LEADER');
    });

    it('should create a new team with members and return 201', async () => {
      const teamData = {
        name: 'Bravo Team',
        description: 'The second team.',
        members: [
          { userId: memberUser.id, role: 'MEMBER' },
          { userId: nonAdminUser.id, role: 'MEMBER' },
        ],
      };

      const res = await request(server)
        .post(`/api/organization/${organization.id}/team`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(teamData);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teamMembers.length).toBe(3); // Creator + 2 members
    });

    it('should not create a team with a duplicate name and return 409', async () => {
      const teamData = {
        name: 'Charlie Team',
        description: 'The third team.',
      };
      // Create it once
      await request(server)
        .post(`/api/organization/${organization.id}/team`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(teamData);

      // Try to create it again
      const res = await request(server)
        .post(`/api/organization/${organization.id}/team`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(teamData);

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toBe('Team with this name already exists');
    });

    it('should return 403 if a non-admin/non-owner tries to create a team', async () => {
      const teamData = {
        name: 'Delta Team',
        description: 'The fourth team.',
      };
      const res = await request(server)
        .post(`/api/organization/${organization.id}/team`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send(teamData);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('GET /api/organization/:organizationId/teams/all', () => {
    it('should return a list of teams for the organization', async () => {
      await prisma.team.create({
        data: {
          name: 'Echo Team',
          organizationId: organization.id,
          createdBy: testUser.id,
        },
      });

      const res = await request(server)
        .get(`/api/organization/${organization.id}/teams/all`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.teams.length).toBe(1);
      expect(res.body.data.teams[0].name).toBe('Echo Team');
    });
  });

  describe('GET /api/organization/:organizationId/teams/:teamId', () => {
    it('should return a specific team', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Foxtrot Team',
          organizationId: organization.id,
          createdBy: testUser.id,
        },
      });

      const res = await request(server)
        .get(`/api/organization/${organization.id}/teams/${team.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.team.name).toBe('Foxtrot Team');
    });

    it('should return 404 for a non-existent team', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(server)
        .get(`/api/organization/${organization.id}/teams/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('PUT /api/organization/:organizationId/team/:teamId', () => {
    it('should update the team and return 200', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Golf Team',
          organizationId: organization.id,
          createdBy: testUser.id,
        },
      });

      const updateData = { name: 'Golf Team Updated' };

      const res = await request(server)
        .put(`/api/organization/${organization.id}/team/${team.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.team.name).toBe('Golf Team Updated');
    });
  });

  describe('POST /api/organization/:organizationId/team/:teamId/addMember', () => {
    it('should add a member to the team and return 200', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Hotel Team',
          organizationId: organization.id,
          createdBy: testUser.id,
        },
      });
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: testUser.id,
          role: 'LEADER',
        },
      });

      const addMemberData = {
        members: [{ userId: memberUser.id, role: 'MEMBER' }],
      };

      const res = await request(server)
        .post(`/api/organization/${organization.id}/team/${team.id}/addMember`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(addMemberData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.teamMembers.length).toBe(2);
    });
  });

  describe('DELETE /api/organization/:organizationId/team/:teamId/members/:userId', () => {
    it('should remove a member from the team and return 200', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'India Team',
          organizationId: organization.id,
          createdBy: testUser.id,
        },
      });
      await prisma.teamMember.createMany({
        data: [
          { teamId: team.id, userId: testUser.id, role: 'LEADER' },
          { teamId: team.id, userId: memberUser.id, role: 'MEMBER' },
        ],
      });

      const res = await request(server)
        .delete(
          `/api/organization/${organization.id}/team/${team.id}/members/${memberUser.id}`,
        )
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);

      const deletedMember = await prisma.teamMember.findFirst({
        where: { teamId: team.id, userId: memberUser.id },
      });
      expect(deletedMember.deletedAt).not.toBeNull();
    });
  });

  describe('DELETE /api/organization/:organizationId/team/:teamId', () => {
    it('should soft delete the team and return 200', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Juliett Team',
          organizationId: organization.id,
          createdBy: testUser.id,
        },
      });

      const res = await request(server)
        .delete(`/api/organization/${organization.id}/team/${team.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toEqual(200);

      const deletedTeam = await prisma.team.findUnique({
        where: { id: team.id },
      });
      expect(deletedTeam.deletedAt).not.toBeNull();
    });
  });
});
