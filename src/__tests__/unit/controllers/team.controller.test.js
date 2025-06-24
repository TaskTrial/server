/* eslint-env node */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  createTeam,
  addTeamMember,
  removeTeamMember,
  updateTeam,
  uploadTeamAvatar,
  deleteTeamAvatar,
  deleteTeam,
  getAllTeams,
  getSpecificTeam,
} from '../../../controllers/team.controller.js';
import {
  mockPrisma,
  mockCreateActivityLog,
  mockGenerateActivityDetails,
  mockUploadToCloudinary,
  mockDeleteFromCloudinary,
} from '../../setup.js';
import { Buffer } from 'buffer';

import '../../setup.js';

jest.mock('../../../validations/team.validation.js', () => ({
  addTeamMemberValidation: jest.fn(),
  createTeamValidation: jest.fn(),
  updateTeamValidation: jest.fn(),
}));

function mockRequest() {
  const req = {};
  req.body = {};
  req.params = {};
  req.query = {};
  req.cookies = {};
  req.headers = {};
  req.ip = '127.0.0.1';
  req.user = null;
  return req;
}

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
}

describe('Team Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createTeam', () => {
    it('should create a team successfully', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = {
        name: 'Team A',
        description: 'Desc',
        avatar: 'img.png',
        members: [],
      };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };
      const team = {
        id: 'team-id',
        name: 'Team A',
        description: 'Desc',
        createdBy: 'user-id',
        organizationId: 'org-id',
      };
      const leaderMember = {
        id: 'leader-id',
        teamId: 'team-id',
        userId: 'user-id',
        role: 'LEADER',
        isActive: true,
      };
      const allTeamMembers = [leaderMember];

      const { createTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      createTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(null);
      mockPrisma.team.create.mockResolvedValue(team);
      mockPrisma.teamMember.create.mockResolvedValue(leaderMember);
      mockPrisma.teamMember.findMany.mockResolvedValue(allTeamMembers);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const result = await callback(mockPrisma);
        return result;
      });

      mockCreateActivityLog.mockResolvedValue({});
      mockGenerateActivityDetails.mockReturnValue({});

      await createTeam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Team created successfully'),
          data: expect.any(Object),
        }),
      );
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-org' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { name: 'Team A' };
      const { createTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      createTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await createTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'USER' };
      req.body = { name: 'Team A' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'user-id' }],
      };
      const { createTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      createTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      await createTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          'You do not have permission to create teams in this department',
      });
    });

    it('should return error if validation fails', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { name: '' };
      const { createTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      createTeamValidation.mockReturnValue({
        error: { details: [{ message: 'Name is required' }] },
      });
      await createTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: ['Name is required'],
      });
    });

    it('should return error if team with same name exists', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { name: 'Team A' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };
      const { createTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      createTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue({
        id: 'team-id',
        name: 'Team A',
      });
      await createTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Team with this name already exists',
      });
    });

    it('should handle unique constraint error (P2002)', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { name: 'Team A' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };
      const { createTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      createTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockRejectedValue({ code: 'P2002' });
      await createTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Team with this name already exists in this organization',
      });
    });

    it('should handle unexpected errors', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { name: 'Team A' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };
      const { createTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      createTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));
      await createTeam(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --- addTeamMember ---
  describe('addTeamMember', () => {
    it('should add team members successfully', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { members: [{ userId: 'member-1', role: 'MEMBER' }] };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'user-id' };
      const { addTeamMemberValidation } = await import(
        '../../../validations/team.validation.js'
      );
      addTeamMemberValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'member-1' }]);
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);
      mockPrisma.teamMember.create.mockResolvedValue({
        id: 'new-member-id',
        userId: 'member-1',
        role: 'MEMBER',
      });
      mockPrisma.teamMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          userId: 'member-1',
          role: 'MEMBER',
          user: {
            id: 'member-1',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@test.com',
            profilePic: null,
          },
        },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockCreateActivityLog.mockResolvedValue({});
      mockGenerateActivityDetails.mockReturnValue({});
      await addTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Members added successfully'),
          data: expect.any(Object),
        }),
      );
    });
    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-org', teamId: 'team-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { members: [] };
      const { addTeamMemberValidation } = await import(
        '../../../validations/team.validation.js'
      );
      addTeamMemberValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await addTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });
    it('should return error if team not found', async () => {
      req.params = { organizationId: 'org-id', teamId: 'invalid-team' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { members: [] };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };
      const { addTeamMemberValidation } = await import(
        '../../../validations/team.validation.js'
      );
      addTeamMemberValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(null);
      await addTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Team not found',
      });
    });
    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'user-id', role: 'USER' };
      req.body = { members: [] };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'user-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'other-user' };
      const { addTeamMemberValidation } = await import(
        '../../../validations/team.validation.js'
      );
      addTeamMemberValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);
      await addTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('permission'),
      });
    });
    it('should return error if validation fails', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { members: [] };
      const { addTeamMemberValidation } = await import(
        '../../../validations/team.validation.js'
      );
      addTeamMemberValidation.mockReturnValue({
        error: { details: [{ message: 'Members required' }] },
      });
      await addTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: ['Members required'],
      });
    });
    it('should handle unexpected errors', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { members: [] };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        users: [{ id: 'user-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'user-id' };
      const { addTeamMemberValidation } = await import(
        '../../../validations/team.validation.js'
      );
      addTeamMemberValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));
      await addTeamMember(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --- removeTeamMember ---
  describe('removeTeamMember', () => {
    it('should remove a team member successfully', async () => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        userId: 'member-1',
      };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      const teamMember = {
        id: 'member-1',
        userId: 'member-1',
        teamId: 'team-id',
        user: { firstName: 'Test', lastName: 'User' },
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst.mockResolvedValue(teamMember);
      mockPrisma.teamMember.findMany.mockResolvedValue([]);
      mockPrisma.teamMember.update.mockResolvedValue({
        ...teamMember,
        deletedAt: new Date(),
        isActive: false,
      });
      mockCreateActivityLog.mockResolvedValue({});
      mockGenerateActivityDetails.mockReturnValue({});
      await removeTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('removed successfully'),
          data: expect.any(Object),
        }),
      );
    });
    it('should return error if organization not found', async () => {
      req.params = {
        organizationId: 'invalid-org',
        teamId: 'team-id',
        userId: 'member-1',
      };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await removeTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });
    it('should return error if team not found', async () => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'invalid-team',
        userId: 'member-1',
      };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(null);
      await removeTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Team not found',
      });
    });
    it('should return error if team member not found', async () => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        userId: 'invalid-member',
      };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);
      await removeTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Team member not found or already removed',
      });
    });
    it('should return error if user lacks permission', async () => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        userId: 'member-1',
      };
      req.user = { id: 'user-id', role: 'USER' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'user-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'other-user' };
      const teamMember = {
        id: 'member-1',
        userId: 'member-1',
        teamId: 'team-id',
        user: { firstName: 'Test', lastName: 'User' },
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst
        .mockResolvedValueOnce(teamMember)
        .mockResolvedValueOnce(null);
      await removeTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('permission'),
      });
    });
    it('should return error if removing only team leader', async () => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        userId: 'admin-id',
      };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      const teamMember = {
        id: 'admin-id',
        userId: 'admin-id',
        teamId: 'team-id',
        user: { firstName: 'Admin', lastName: 'User' },
        role: 'LEADER',
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst.mockResolvedValue(teamMember);
      mockPrisma.teamMember.findMany.mockResolvedValue([]);
      await removeTeamMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('Cannot remove the only team leader'),
      });
    });
    it('should handle unexpected errors', async () => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        userId: 'member-1',
      };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      const teamMember = {
        id: 'member-1',
        userId: 'member-1',
        teamId: 'team-id',
        user: { firstName: 'Test', lastName: 'User' },
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst.mockResolvedValue(teamMember);
      mockPrisma.teamMember.findMany.mockResolvedValue([
        { id: 'other-leader', userId: 'other-leader', role: 'LEADER' },
      ]);
      mockPrisma.teamMember.update.mockRejectedValue(new Error('DB error'));
      await removeTeamMember(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --- updateTeam ---
  describe('updateTeam', () => {
    it('should update a team successfully', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.body = {
        name: 'Updated Team',
        description: 'Updated Desc',
        avatar: 'img2.png',
      };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      const updatedTeam = {
        id: 'team-id',
        name: 'Updated Team',
        description: 'Updated Desc',
        avatar: 'img2.png',
      };
      const { updateTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      updateTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.team.findFirst.mockResolvedValueOnce(team);
      mockPrisma.team.findFirst.mockResolvedValueOnce(null); // No duplicate
      mockPrisma.team.update.mockResolvedValue(updatedTeam);
      mockCreateActivityLog.mockResolvedValue({});
      mockGenerateActivityDetails.mockReturnValue({});
      await updateTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        team: updatedTeam,
      });
    });
    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-org', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.body = { name: 'Updated Team' };
      const { updateTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      updateTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await updateTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });
    it('should return error if team not found', async () => {
      req.params = { organizationId: 'org-id', teamId: 'invalid-team' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.body = { name: 'Updated Team' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const { updateTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      updateTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(null);
      await updateTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Team not found',
      });
    });
    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'user-id', role: 'USER' };
      req.body = { name: 'Updated Team' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'user-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'other-user' };
      const { updateTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      updateTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);
      await updateTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('permission'),
      });
    });
    it('should return error if validation fails', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.body = { name: '' };
      const { updateTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      updateTeamValidation.mockReturnValue({
        error: { details: [{ message: 'Name is required' }] },
      });
      await updateTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: ['Name is required'],
      });
    });
    it('should return error if duplicate team name exists', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.body = { name: 'Duplicate Team' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      const duplicateTeam = { id: 'other-team-id', name: 'Duplicate Team' };
      const { updateTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      updateTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.team.findFirst.mockResolvedValueOnce(team);
      mockPrisma.team.findFirst.mockResolvedValueOnce(duplicateTeam);
      await updateTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          'A team with the name "Duplicate Team" already exists in this organization',
      });
    });
    it('should handle unexpected errors', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.body = { name: 'Updated Team' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      const { updateTeamValidation } = await import(
        '../../../validations/team.validation.js'
      );
      updateTeamValidation.mockReturnValue({ error: null });
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.team.findFirst.mockResolvedValueOnce(team);
      mockPrisma.team.findFirst.mockResolvedValueOnce(null);
      mockPrisma.team.update.mockRejectedValue(new Error('DB error'));
      await updateTeam(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --- uploadTeamAvatar ---
  describe('uploadTeamAvatar', () => {
    it('should upload team avatar successfully', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.file = { buffer: Buffer.from('test') };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      const updatedTeam = { id: 'team-id', avatar: 'cloudinary-url' };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockUploadToCloudinary.mockResolvedValue('cloudinary-url');
      mockPrisma.team.update.mockResolvedValue(updatedTeam);
      mockCreateActivityLog.mockResolvedValue({});
      await uploadTeamAvatar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: expect.stringContaining('uploaded successfully'),
        team: updatedTeam,
      });
    });
    it('should return error if no file uploaded', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.file = null;
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      await uploadTeamAvatar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'No file uploaded' });
    });
    it('should handle unexpected errors', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.file = { buffer: Buffer.from('test') };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockUploadToCloudinary.mockRejectedValue(new Error('Cloudinary error'));
      await uploadTeamAvatar(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --- deleteTeamAvatar ---
  describe('deleteTeamAvatar', () => {
    it('should delete team avatar successfully', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = {
        id: 'team-id',
        name: 'Team A',
        createdBy: 'admin-id',
        avatar: 'cloudinary-url',
      };
      const updatedTeam = { id: 'team-id', avatar: null };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockDeleteFromCloudinary.mockResolvedValue();
      mockPrisma.team.update.mockResolvedValue(updatedTeam);
      mockCreateActivityLog.mockResolvedValue({});
      await deleteTeamAvatar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining('deleted successfully'),
        team: updatedTeam,
      });
    });
    it('should return error if team avatar not found', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = {
        id: 'team-id',
        name: 'Team A',
        createdBy: 'admin-id',
        avatar: null,
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      await deleteTeamAvatar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Team avatar not found',
      });
    });
    it('should handle unexpected errors', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = {
        id: 'team-id',
        name: 'Team A',
        createdBy: 'admin-id',
        avatar: 'cloudinary-url',
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockDeleteFromCloudinary.mockRejectedValue(new Error('Cloudinary error'));
      await deleteTeamAvatar(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --- deleteTeam ---
  describe('deleteTeam', () => {
    it('should delete a team successfully', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.team.update.mockResolvedValue({
        ...team,
        deletedAt: new Date(),
      });
      mockPrisma.teamMember.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectMember.deleteMany.mockResolvedValue({ count: 0 });
      mockCreateActivityLog.mockResolvedValue({});
      await deleteTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('deleted successfully'),
          data: expect.any(Object),
        }),
      );
    });
    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-org', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await deleteTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });
    it('should return error if team not found', async () => {
      req.params = { organizationId: 'org-id', teamId: 'invalid-team' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(null);
      await deleteTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Team not found or already deleted',
      });
    });
    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'user-id', role: 'USER' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'user-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'other-user' };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);
      await deleteTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('permission'),
      });
    });
    it('should handle unexpected errors', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = { id: 'team-id', name: 'Team A', createdBy: 'admin-id' };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));
      await deleteTeam(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --- getAllTeams ---
  describe('getAllTeams', () => {
    it('should get all teams successfully', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.query = { page: 1, limit: 10, search: '' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const teams = [
        {
          id: 'team-id',
          name: 'Team A',
          creator: {
            id: 'admin-id',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@test.com',
            profilePic: null,
          },
          members: [],
          createdBy: 'admin-id',
        },
      ];
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findMany.mockResolvedValue(teams);
      mockPrisma.team.count.mockResolvedValue(1);
      await getAllTeams(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Object) }),
      );
    });
    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-org' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.query = { page: 1, limit: 10, search: '' };
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await getAllTeams(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });
    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'USER' };
      req.query = { page: 1, limit: 10, search: '' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'another-user-id' }],
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      await getAllTeams(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('permission'),
      });
    });
    it('should handle unexpected errors', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      req.query = { page: 1, limit: 10, search: '' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findMany.mockRejectedValue(new Error('DB error'));
      await getAllTeams(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // --- getSpecificTeam ---
  describe('getSpecificTeam', () => {
    it('should get specific team details successfully', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      const team = {
        id: 'team-id',
        name: 'Team A',
        createdBy: 'admin-id',
        members: [],
        projects: [],
        reports: [],
        department: {},
        creator: {
          id: 'admin-id',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@test.com',
          profilePic: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findMany.mockResolvedValue([]);
      await getSpecificTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Object) }),
      );
    });
    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-org', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await getSpecificTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });
    it('should return error if team not found', async () => {
      req.params = { organizationId: 'org-id', teamId: 'invalid-team' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(null);
      await getSpecificTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Team not found',
      });
    });
    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'user-id', role: 'USER' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        users: [{ id: 'another-user-id' }],
      };
      const team = {
        id: 'team-id',
        name: 'Team A',
        createdBy: 'other-user',
        members: [],
        projects: [],
        reports: [],
        department: {},
        creator: {
          id: 'other-user',
          firstName: 'Other',
          lastName: 'User',
          email: 'other@test.com',
          profilePic: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockResolvedValue(team);
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);
      await getSpecificTeam(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('permission'),
      });
    });
    it('should handle unexpected errors', async () => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.user = { id: 'admin-id', role: 'ADMIN' };
      const organization = {
        id: 'org-id',
        owners: [{ userId: 'admin-id' }],
        users: [{ id: 'admin-id' }],
      };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.team.findFirst.mockRejectedValue(new Error('DB error'));
      await getSpecificTeam(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
