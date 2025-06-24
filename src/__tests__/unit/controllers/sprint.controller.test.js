import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  createSprint,
  updateSprint,
  updateSprintStatus,
  getAllSprints,
  getSpecificSprint,
  deleteSprint,
} from '../../../controllers/sprint.controller.js';
import prisma from '../../../config/prismaClient.js';

jest.mock('../../../config/prismaClient.js', () => ({
  __esModule: true,
  default: {
    organization: { findFirst: jest.fn() },
    team: { findFirst: jest.fn() },
    project: { findFirst: jest.fn() },
    sprint: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    task: { count: jest.fn(), updateMany: jest.fn() },
    projectMember: { findFirst: jest.fn() },
    organizationMember: { findFirst: jest.fn() },
  },
}));

jest.mock('../../../validations/sprint.validation.js', () => ({
  sprintvalidation: jest.fn(() => ({ error: null })),
  updateSprintStatusValidation: jest.fn(() => ({ error: null })),
  updateSprintValidation: { validate: jest.fn(() => ({ error: null })) },
}));

jest.mock('../../../utils/activityLogs.utils.js', () => ({
  createActivityLog: jest.fn(),
  generateActivityDetails: jest.fn(),
}));

const mockReq = () => ({
  params: {},
  body: {},
  query: {},
  user: {
    id: 'user-id',
    role: 'ADMIN',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
  },
});
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Sprint Controller', () => {
  let req, res, next;
  beforeEach(() => {
    req = mockReq();
    res = mockRes();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createSprint', () => {
    beforeEach(() => {
      req.params = {
        organizationId: 'org1',
        teamId: 'team1',
        projectId: 'proj1',
      };
      req.body = {
        name: 'Sprint 1',
        description: 'desc',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        goal: 'Goal',
      };
      prisma.organization.findFirst.mockResolvedValue({
        id: 'org1',
        owners: [{ userId: 'user-id' }],
      });
      prisma.team.findFirst.mockResolvedValue({
        id: 'team1',
        createdBy: 'user-id',
      });
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj1',
        ProjectMember: [{ role: 'PROJECT_OWNER' }],
      });
      prisma.sprint.findFirst.mockResolvedValue(null);
      prisma.sprint.create.mockResolvedValue({ id: 'sprint1', ...req.body });
    });

    it('should create a sprint successfully', async () => {
      await createSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 403 if user lacks permission', async () => {
      req.user.role = 'MEMBER';
      prisma.organization.findFirst.mockResolvedValue({
        id: 'org1',
        owners: [],
      });
      prisma.team.findFirst.mockResolvedValue({
        id: 'team1',
        createdBy: 'another-user',
      });
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj1',
        ProjectMember: [],
      });
      await createSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if sprint dates overlap', async () => {
      prisma.sprint.findFirst.mockResolvedValueOnce({ id: 'existing-sprint' });
      await createSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateSprint', () => {
    beforeEach(() => {
      req.params = {
        sprintId: 'sprint1',
        projectId: 'proj1',
        teamId: 'team1',
        organizationId: 'org1',
      };
      req.body = {
        name: 'Updated Sprint',
        startDate: '2024-01-02',
        endDate: '2024-01-11',
      };
      prisma.organization.findFirst.mockResolvedValue({
        id: 'org1',
        owners: [{ userId: 'user-id' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'team1' });
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj1',
        ProjectMember: [{ role: 'PROJECT_OWNER' }],
      });
      prisma.sprint.update.mockResolvedValue({});
    });

    it('should update a sprint successfully', async () => {
      prisma.sprint.findFirst.mockResolvedValueOnce({
        id: 'sprint1',
        name: 'Old Name',
      });
      prisma.sprint.findFirst.mockResolvedValueOnce(null);
      await updateSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if sprint not found', async () => {
      prisma.sprint.findFirst.mockResolvedValue(null);
      await updateSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if sprint name is not unique', async () => {
      prisma.sprint.findFirst.mockResolvedValueOnce({
        id: 'sprint1',
        name: 'Old Name',
      }); // check if sprint exists
      prisma.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint2' }); // name check
      await updateSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if start date is after end date', async () => {
      req.body.startDate = '2024-01-11';
      req.body.endDate = '2024-01-10';
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sprint1',
        name: 'Old Name',
      });
      await updateSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if sprint dates overlap', async () => {
      prisma.sprint.findFirst
        .mockResolvedValueOnce({ id: 'sprint1', name: 'Old Name' }) // Find existing sprint
        .mockResolvedValueOnce(null) // No duplicate name
        .mockResolvedValueOnce({ id: 'sprint2' }); // Overlapping sprint found
      await updateSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should call next(error) for unexpected errors', async () => {
      const error = new Error('Unexpected');
      req.body = { description: 'A new description' };
      prisma.sprint.findFirst.mockResolvedValue({
        id: 'sprint1',
        name: 'Old Name',
      });
      prisma.sprint.update.mockRejectedValue(error);
      await updateSprint(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateSprintStatus', () => {
    beforeEach(() => {
      req.params = {
        sprintId: 'sprint1',
        projectId: 'proj1',
        teamId: 'team1',
        organizationId: 'org1',
      };
      req.body = { status: 'ACTIVE' };
      prisma.organization.findFirst.mockResolvedValue({
        id: 'org1',
        owners: [{ userId: 'user-id' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'team1' });
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj1',
        ProjectMember: [{ role: 'PROJECT_OWNER' }],
      });
      prisma.sprint.findFirst.mockResolvedValue({
        status: 'PLANNING',
        startDate: new Date(),
      });
      prisma.sprint.update.mockResolvedValue({});
    });

    it('should update sprint status successfully', async () => {
      await updateSprintStatus(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getAllSprints', () => {
    beforeEach(() => {
      req.params = {
        projectId: 'proj1',
        organizationId: 'org1',
        teamId: 'team1',
      };
      req.user = { id: 'user-id', role: 'MEMBER' };
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'pm1' });
      prisma.sprint.count.mockResolvedValue(1);
      prisma.sprint.findMany.mockResolvedValue([
        {
          id: 'sprint1',
          name: 'Sprint 1',
          description: 'desc',
          startDate: new Date(),
          endDate: new Date(),
          status: 'PLANNING',
          goal: 'Goal',
          _count: { tasks: 5 },
          createdAt: new Date(),
        },
      ]);
    });

    it('should return all sprints successfully', async () => {
      await getAllSprints(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('getSpecificSprint', () => {
    beforeEach(() => {
      req.params = {
        sprintId: 'sprint1',
        projectId: 'proj1',
        organizationId: 'org1',
        teamId: 'team1',
      };
      req.user = { id: 'user-id', role: 'MEMBER' };
      prisma.projectMember.findFirst.mockResolvedValue({ id: 'pm1' });
      prisma.sprint.findUnique.mockResolvedValue({
        endDate: new Date(),
        tasks: [],
        activityLogs: [],
        _count: { tasks: 0 },
      });
      prisma.task.count.mockResolvedValue(0);
    });

    it('should return a specific sprint successfully', async () => {
      await getSpecificSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if sprint not found', async () => {
      prisma.sprint.findUnique.mockResolvedValue(null);
      await getSpecificSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteSprint', () => {
    beforeEach(() => {
      req.params = {
        sprintId: 'sprint1',
        projectId: 'proj1',
        teamId: 'team1',
        organizationId: 'org1',
      };
      prisma.organization.findFirst.mockResolvedValue({
        id: 'org1',
        owners: [{ userId: 'user-id' }],
      });
      prisma.team.findFirst.mockResolvedValue({ id: 'team1' });
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj1',
        ProjectMember: [{ role: 'PROJECT_OWNER' }],
      });
      prisma.sprint.findUnique.mockResolvedValue({
        status: 'PLANNING',
        _count: { tasks: 0 },
      });
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
      prisma.sprint.update.mockResolvedValue({});
    });

    it('should delete a sprint successfully', async () => {
      await deleteSprint(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
