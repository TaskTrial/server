/* eslint-env node */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  createProject,
  updateProject,
  updateProjectStatus,
  updateProjectPriority,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getAllProjects,
  getSpecificProject,
  getProjectsInSpecificOrg,
} from '../../../controllers/project.controller.js';
import { mockPrisma } from '../../setup.js';
import {
  createProjectValidation,
  updateProjectValidation,
} from '../../../validations/project.validation.js';

jest.mock('../../../validations/project.validation.js', () => ({
  createProjectValidation: jest.fn(),
  updateProjectValidation: jest.fn(),
}));

jest.mock('../../../utils/activityLogs.utils.js', () => ({
  createActivityLog: jest.fn(),
  generateActivityDetails: jest.fn(),
}));

const mockRequest = () => {
  const req = {};
  req.body = {};
  req.params = {};
  req.query = {};
  req.user = { id: 'user-id', role: 'ADMIN' }; // Default user
  return req;
};

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Project Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
    createProjectValidation.mockReturnValue({ error: null });
    updateProjectValidation.mockReturnValue({ error: null });
  });

  describe('createProject', () => {
    beforeEach(() => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      req.body = {
        name: 'New Project',
        description: 'A test project',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        members: [],
      };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
      });
      mockPrisma.team.findFirst.mockResolvedValue({
        id: 'team-id',
        createdBy: 'user-id',
      });
    });

    it('should create a project successfully', async () => {
      const createdProject = { id: 'project-id', ...req.body };
      mockPrisma.$transaction.mockResolvedValue({
        project: createdProject,
        projectLeader: {},
        projectMembers: [],
      });

      await createProject(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Project created successfully.' }),
      );
    });

    it('should handle P2002 error for unique project name', async () => {
      mockPrisma.$transaction.mockRejectedValue({ code: 'P2002' });
      await createProject(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'A project with this name already exists in this organization',
      });
    });

    it('should handle general errors by passing them to next', async () => {
      const error = new Error('Some unexpected error');
      mockPrisma.organization.findFirst.mockRejectedValue(error);
      await createProject(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProject', () => {
    beforeEach(() => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        projectId: 'project-id',
      };
      req.body = { name: 'Updated Project Name' };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
      });
      mockPrisma.team.findFirst.mockResolvedValue({
        id: 'team-id',
        createdBy: 'user-id',
      });
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'project-id',
        name: 'Old Name',
      });
    });

    it('should update a project successfully', async () => {
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-id',
        ...req.body,
      });
      mockPrisma.project.findFirst
        .mockResolvedValueOnce({ id: 'project-id', name: 'Old Name' })
        .mockResolvedValueOnce(null);
      await updateProject(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Project updated successfully' }),
      );
    });

    it('should return 400 for duplicate project name', async () => {
      mockPrisma.project.update.mockRejectedValue({ code: 'P2002' });
      await updateProject(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'A project with this name already exists in this organization',
        }),
      );
    });
  });

  describe('updateProjectStatus', () => {
    beforeEach(() => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        projectId: 'project-id',
      };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        owners: [{ userId: req.user.id }],
      });
      mockPrisma.team.findFirst.mockResolvedValue({ id: 'team-id' });
      mockPrisma.projectMember.findFirst.mockResolvedValue({ id: 'pm-id' });
    });

    it('should return 200 if status is unchanged', async () => {
      req.body = { status: 'PLANNING' };
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'project-id',
        status: 'PLANNING',
      });
      await updateProjectStatus(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Project status remains unchanged',
        }),
      );
    });

    it('should return 400 for invalid status value', async () => {
      req.body = { status: 'INVALID_STATUS' };
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'project-id',
        status: 'PLANNING',
      });
      await updateProjectStatus(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Status must be one of'),
        }),
      );
    });
  });

  describe('updateProjectPriority', () => {
    beforeEach(() => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        projectId: 'project-id',
      };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        owners: [{ userId: req.user.id }],
      });
      mockPrisma.team.findFirst.mockResolvedValue({ id: 'team-id' });
      mockPrisma.projectMember.findFirst.mockResolvedValue({ id: 'pm-id' });
    });

    it('should return 200 if priority is unchanged', async () => {
      req.body = { priority: 'MEDIUM' };
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'project-id',
        priority: 'MEDIUM',
      });
      await updateProjectPriority(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Project priority remains unchanged',
        }),
      );
    });

    it('should return 400 for invalid priority value', async () => {
      req.body = { priority: 'INVALID_PRIORITY' };
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'project-id',
        priority: 'MEDIUM',
      });
      await updateProjectPriority(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Priority must be one of'),
        }),
      );
    });
  });

  describe('deleteProject', () => {
    beforeEach(() => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        projectId: 'project-id',
      };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
      });
      mockPrisma.team.findFirst.mockResolvedValue({
        id: 'team-id',
        createdBy: 'user-id',
      });
    });

    it('should delete a project successfully', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-id' });
      mockPrisma.project.update.mockResolvedValue({});
      await deleteProject(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Project deleted successfully' }),
      );
    });
  });

  describe('addProjectMember', () => {
    beforeEach(() => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        projectId: 'project-id',
      };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
      });
      mockPrisma.team.findFirst.mockResolvedValue({
        id: 'team-id',
        createdBy: 'user-id',
      });
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-id' });
    });

    it('should add project members successfully', async () => {
      req.body = { members: [{ userId: 'new-member-id', role: 'MEMBER' }] };
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'new-member-id' }]);
      mockPrisma.projectMember.findMany.mockResolvedValue([]);
      mockPrisma.projectMember.createMany.mockResolvedValue({ count: 1 });
      await addProjectMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Successfully added 1 members'),
        }),
      );
    });

    it('should return 400 if members array is not provided or empty', async () => {
      req.body = { members: [] };
      await addProjectMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Members should be a non-empty array',
      });

      req.body = {};
      await addProjectMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Members ID is required',
      });
    });

    it('should return 404 if no specified users are found', async () => {
      req.body = { members: [{ userId: 'not-a-user-id' }] };
      mockPrisma.user.findMany.mockResolvedValue([]);
      await addProjectMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'None of the specified users were found',
        }),
      );
    });

    it('should return 200 if all users are already members', async () => {
      req.body = { members: [{ userId: 'existing-member-id' }] };
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'existing-member-id' },
      ]);
      mockPrisma.projectMember.findMany.mockResolvedValue([
        { userId: 'existing-member-id' },
      ]);
      await addProjectMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All users are already members of this project',
      });
    });
  });

  describe('removeProjectMember', () => {
    beforeEach(() => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        projectId: 'project-id',
      };
      req.body = { userId: 'member-to-remove-id' };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
      });
      mockPrisma.team.findFirst.mockResolvedValue({
        id: 'team-id',
        createdBy: 'user-id',
      });
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'project-id' });
    });

    it('should remove a project member successfully', async () => {
      mockPrisma.projectMember.findFirst.mockResolvedValue({ id: 'pm-id' });
      mockPrisma.projectMember.update.mockResolvedValue({});
      await removeProjectMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Member removed from project successfully',
      });
    });

    it('should return 400 if userId is not provided', async () => {
      req.body.userId = undefined;
      await removeProjectMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'UserId ID is required',
      });
    });

    it('should return 404 if project member is not found', async () => {
      mockPrisma.projectMember.findFirst.mockResolvedValue(null);
      await removeProjectMember(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User is not a member of this project',
      });
    });
  });

  describe('getAllProjects', () => {
    beforeEach(() => {
      req.params = { organizationId: 'org-id', teamId: 'team-id' };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        users: [{ id: req.user.id }],
        owners: [],
      });
      mockPrisma.team.findFirst.mockResolvedValue({ id: 'team-id' });
    });

    it('should return all projects in a team', async () => {
      const projects = [
        {
          id: 'proj1',
          _count: { ProjectMember: 1 },
          ProjectMember: [],
        },
        {
          id: 'proj2',
          _count: { ProjectMember: 1 },
          ProjectMember: [],
        },
      ];
      mockPrisma.project.findMany.mockResolvedValue(projects);
      await getAllProjects(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('getSpecificProject', () => {
    beforeEach(() => {
      req.params = {
        organizationId: 'org-id',
        teamId: 'team-id',
        projectId: 'project-id',
      };
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        users: [{ id: req.user.id }],
        owners: [],
      });
      mockPrisma.team.findFirst.mockResolvedValue({ id: 'team-id' });
    });

    it('should return a specific project', async () => {
      const project = {
        id: 'project-id',
        name: 'Test Project',
        ProjectMember: [{ userId: req.user.id }],
        tasks: [],
      };
      mockPrisma.project.findFirst.mockResolvedValue(project);
      await getSpecificProject(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Object) }),
      );
    });
  });

  describe('getProjectsInSpecificOrg', () => {
    beforeEach(() => {
      req.params = { organizationId: 'org-id' };
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'org-id' });
    });
    it('should return all projects in an organization', async () => {
      const projects = [];
      mockPrisma.project.findMany.mockResolvedValue(projects);
      mockPrisma.project.count.mockResolvedValue(0);
      await getProjectsInSpecificOrg(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });
});
