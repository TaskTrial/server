/* eslint-env node */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  createOrganization,
  joinToOrg,
  userOrgStatus,
  resendOTP,
  verifyOrganization,
  getAllOrganizations,
  getSpecificOrganization,
  updateOrganization,
  deleteOrganization,
  addOwners,
  uploadOrganizationLogo,
  deleteOrganizationLogo,
  getAllOrganizationUsers,
} from '../../../controllers/organization.controller.js';
import {
  mockPrisma,
  mockGenerateOTP,
  mockHashOTP,
  mockValidateOTP,
  mockSendEmail,
  mockCreateActivityLog,
  mockUploadToCloudinary,
  mockDeleteFromCloudinary,
} from '../../setup.js';

/* eslint no-undef: off */

// Mock validation schemas
jest.mock('../../../validations/organization.validation.js', () => ({
  createOrganizationValidation: jest.fn(),
  updateOrganizationValidation: jest.fn(),
  verifyOrganizationValidation: jest.fn(),
  addOwnersValidation: jest.fn(),
}));

describe('Organization Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    it('should create organization successfully', async () => {
      const orgData = {
        name: 'Test Organization',
        description: 'Test description',
        industry: 'Technology',
        sizeRange: '10-50',
        website: 'https://test.com',
        logoUrl: 'https://logo.com',
        address: 'Test Address',
        contactEmail: 'test@org.com',
        contactPhone: '+1234567890',
      };

      req.body = orgData;
      req.user = { id: 'user-id' };

      const { createOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      createOrganizationValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(null);
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashed-otp');
      mockCreateActivityLog.mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          organization: {
            create: jest.fn().mockResolvedValue({
              id: 'org-id',
              name: orgData.name,
              status: 'APPROVED',
              isVerified: true,
              joinCode: 'ABC12345',
              createdAt: new Date(),
            }),
          },
          organizationOwner: {
            create: jest.fn().mockResolvedValue({
              id: 'owner-id',
              organizationId: 'org-id',
              userId: 'user-id',
            }),
          },
          user: {
            update: jest.fn().mockResolvedValue({
              id: 'user-id',
              organizationId: 'org-id',
              isOwner: true,
            }),
          },
        };
        return await callback(mockTx);
      });

      await createOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Organization created successfully.',
        data: expect.objectContaining({
          organization: expect.objectContaining({
            id: 'org-id',
            name: orgData.name,
          }),
        }),
      });
    });

    it('should return error if validation fails', async () => {
      req.body = { name: '' };
      req.user = { id: 'user-id' };

      const { createOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      createOrganizationValidation.mockReturnValue({
        error: { details: [{ message: 'Name is required' }] },
      });

      await createOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Name is required',
      });
    });

    it('should return error if organization with same name or email exists', async () => {
      const orgData = {
        name: 'Test Organization',
        contactEmail: 'test@org.com',
      };

      req.body = orgData;
      req.user = { id: 'user-id' };

      const { createOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      createOrganizationValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'existing-org-id',
        name: 'Test Organization',
      });

      await createOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Organization with this name or email already exists',
      });
    });
  });

  describe('joinToOrg', () => {
    it('should join organization successfully', async () => {
      const joinCode = 'ABC12345';
      req.body = { joinCode };
      req.user = { id: 'user-id' };

      const organization = {
        id: 'org-id',
        name: 'Test Organization',
        createdAt: new Date(),
        createdBy: 'creator-id',
        industry: 'Technology',
        sizeRange: '10-50',
        logoUrl: 'https://logo.com',
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-id' });
      mockPrisma.activityLog.create.mockResolvedValue({});

      await joinToOrg(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Successfully joined organization',
        organization,
      });
    });

    it('should return error if join code is missing', async () => {
      req.body = {};
      req.user = { id: 'user-id' };

      await joinToOrg(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Join code is required',
      });
    });

    it('should return error if organization not found', async () => {
      req.body = { joinCode: 'INVALID' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await joinToOrg(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid join code or organization not found',
      });
    });

    it('should return error if user is already a member', async () => {
      req.body = { joinCode: 'ABC12345' };
      req.user = { id: 'user-id' };

      const organization = { id: 'org-id', name: 'Test Organization' };
      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-id',
        organizationId: 'org-id',
      });

      await joinToOrg(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'You are already a member of this organization',
      });
    });
  });

  describe('userOrgStatus', () => {
    it('should return organization status when user has organization', async () => {
      req.user = { id: 'user-id' };

      const user = {
        organizationId: 'org-id',
        isOwner: true,
      };

      const organization = {
        id: 'org-id',
        name: 'Test Organization',
        createdAt: new Date(),
        createdBy: 'creator-id',
        industry: 'Technology',
        sizeRange: '10-50',
        logoUrl: 'https://logo.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.organization.findUnique.mockResolvedValue(organization);

      await userOrgStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        hasOrganization: true,
        isOwner: true,
        organization,
      });
    });

    it('should return no organization status when user has no organization', async () => {
      req.user = { id: 'user-id' };

      const user = {
        organizationId: null,
        isOwner: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      await userOrgStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        hasOrganization: false,
      });
    });
  });

  describe('resendOTP', () => {
    it('should resend OTP successfully', async () => {
      const orgId = 'org-id';
      req.params = { orgId };
      req.user = { id: 'user-id' };

      const organization = {
        id: orgId,
        name: 'Test Organization',
        contactEmail: 'test@org.com',
      };

      mockPrisma.organization.findUnique.mockResolvedValue(organization);
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashed-otp');
      mockSendEmail.mockResolvedValue({});
      mockCreateActivityLog.mockResolvedValue({});

      await resendOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Code send successfully. Please check your email',
      });
    });

    it('should return error if organization ID is missing', async () => {
      req.params = {};
      req.user = { id: 'user-id' };

      await resendOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization ID is required',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { orgId: 'invalid-id' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await resendOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if email sending fails', async () => {
      const orgId = 'org-id';
      req.params = { orgId };
      req.user = { id: 'user-id' };

      const organization = {
        id: orgId,
        name: 'Test Organization',
        contactEmail: 'test@org.com',
      };

      mockPrisma.organization.findUnique.mockResolvedValue(organization);
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashed-otp');
      mockSendEmail.mockRejectedValue(new Error('Email service error'));

      await resendOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.any(Error),
        message: 'Failed to send verification email. Please try again later.',
      });
    });
  });

  describe('verifyOrganization', () => {
    it('should verify organization successfully', async () => {
      const orgId = 'org-id';
      const otp = '123456';
      req.params = { orgId };
      req.body = { otp };
      req.user = { id: 'user-id' };

      const organization = {
        id: orgId,
        name: 'Test Organization',
        isVerified: false,
        emailVerificationOTP: 'hashed-otp',
        emailVerificationExpires: new Date(Date.now() + 600000), // 10 minutes from now
      };

      const { verifyOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      verifyOrganizationValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockValidateOTP.mockResolvedValue(true);
      mockCreateActivityLog.mockResolvedValue({});

      await verifyOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Organization verified successfully',
      });
    });

    it('should return error if validation fails', async () => {
      req.params = { orgId: 'org-id' };
      req.body = { otp: '' };

      const { verifyOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      verifyOrganizationValidation.mockReturnValue({
        error: { details: [{ message: 'OTP is required' }] },
      });

      await verifyOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'OTP is required',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { orgId: 'invalid-id' };
      req.body = { otp: '123456' };

      const { verifyOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      verifyOrganizationValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await verifyOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Organization not found',
      });
    });

    it('should return success if organization is already verified', async () => {
      req.params = { orgId: 'org-id' };
      req.body = { otp: '123456' };

      const organization = {
        id: 'org-id',
        isVerified: true,
      };

      const { verifyOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      verifyOrganizationValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);

      await verifyOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Organization is already verified',
      });
    });

    it('should return error if OTP is invalid or expired', async () => {
      req.params = { orgId: 'org-id' };
      req.body = { otp: '123456' };

      const organization = {
        id: 'org-id',
        isVerified: false,
        emailVerificationOTP: 'hashed-otp',
        emailVerificationExpires: new Date(Date.now() - 600000), // 10 minutes ago
      };

      const { verifyOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      verifyOrganizationValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockValidateOTP.mockResolvedValue(false);

      await verifyOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or expired OTP',
      });
    });
  });

  describe('getAllOrganizations', () => {
    it('should get all organizations successfully', async () => {
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.query = { page: '1', limit: '10' };

      const organizations = [
        {
          id: 'org-1',
          name: 'Organization 1',
          _count: { users: 5, departments: 2, teams: 3, projects: 4 },
          owners: [
            {
              user: {
                id: 'user-1',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@test.com',
              },
            },
          ],
        },
      ];

      mockPrisma.organization.count.mockResolvedValue(1);
      mockPrisma.organization.findMany.mockResolvedValue(organizations);

      await getAllOrganizations(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Organizations retrieved successfully',
        data: expect.objectContaining({
          organizations: expect.arrayContaining([
            expect.objectContaining({
              id: 'org-1',
              name: 'Organization 1',
            }),
          ]),
          pagination: expect.objectContaining({
            total: 1,
            page: 1,
            limit: 10,
          }),
        }),
      });
    });

    it('should apply filters correctly', async () => {
      req.user = { id: 'user-id', role: 'USER' };
      req.query = {
        name: 'Test',
        industry: 'Technology',
        isVerified: 'true',
      };

      mockPrisma.organization.count.mockResolvedValue(1);
      mockPrisma.organization.findMany.mockResolvedValue([]);

      await getAllOrganizations(req, res, next);

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Test', mode: 'insensitive' },
            industry: 'Technology',
            isVerified: true,
          }),
        }),
      );
    });
  });

  describe('getSpecificOrganization', () => {
    it('should get specific organization successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: organizationId,
        name: 'Test Organization',
        owners: [
          {
            user: {
              id: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@test.com',
              profilePic: 'pic.jpg',
            },
          },
        ],
        departments: [],
        teams: [],
        projects: [],
        users: [],
        _count: {
          users: 5,
          departments: 2,
          teams: 3,
          projects: 4,
          templates: 1,
        },
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);

      await getSpecificOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Organization retrieved successfully',
        data: expect.objectContaining({
          id: organizationId,
          name: 'Test Organization',
        }),
      });
    });

    it('should return error if organization ID is missing', async () => {
      req.params = {};
      req.user = { id: 'user-id' };

      await getSpecificOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization ID is required',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await getSpecificOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if user lacks permission', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.user = { id: 'user-id', role: 'USER' };

      const organization = {
        id: organizationId,
        name: 'Test Organization',
        owners: [{ user: { id: 'other-user' } }],
        users: [{ id: 'other-user' }],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);

      await getSpecificOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to view this organization',
      });
    });
  });

  describe('updateOrganization', () => {
    it('should update organization successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = {
        name: 'Updated Organization',
        description: 'Updated description',
      };

      const existingOrg = {
        id: organizationId,
        name: 'Old Organization',
        contactEmail: 'old@test.com',
        owners: [{ userId: 'user-id' }],
        createdBy: 'user-id',
      };

      const { updateOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      updateOrganizationValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);
      mockPrisma.organization.findFirst.mockResolvedValueOnce(existingOrg);
      mockPrisma.organization.findFirst.mockResolvedValueOnce(null); // For name check
      mockPrisma.organization.update.mockResolvedValue({
        id: organizationId,
        name: 'Updated Organization',
        description: 'Updated description',
        status: 'APPROVAL',
        isVerified: true,
        updatedAt: new Date(),
      });
      mockCreateActivityLog.mockResolvedValue({});

      await updateOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Organization updated successfully',
        note: 'Please verify your organization email',
        data: expect.objectContaining({
          id: 'org-id',
          name: 'Updated Organization',
          description: 'Updated description',
          status: 'APPROVAL',
          isVerified: true,
        }),
      });
    });

    it('should return error if validation fails', async () => {
      req.params = { organizationId: 'org-id' };
      req.body = { name: '' };

      const { updateOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      updateOrganizationValidation.mockReturnValue({
        error: { details: [{ message: 'Name is required' }] },
        value: {},
      });

      await updateOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation error',
        errors: ['Name is required'],
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id' };
      req.body = { name: 'Test' };

      const { updateOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      updateOrganizationValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await updateOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'USER' };
      req.body = { name: 'Test' };

      const existingOrg = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        createdBy: 'other-user',
      };

      const { updateOrganizationValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      updateOrganizationValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);

      await updateOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to update this organization',
      });
    });
  });

  describe('deleteOrganization', () => {
    it('should delete organization successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const existingOrg = {
        id: organizationId,
        name: 'Test Organization',
        owners: [{ userId: 'user-id' }],
        createdBy: 'user-id',
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);
      mockPrisma.organization.update.mockResolvedValue({});
      mockCreateActivityLog.mockResolvedValue({});

      await deleteOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Organization deleted successfully',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id' };
      req.user = { id: 'user-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await deleteOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found or already deleted',
      });
    });

    it('should return error if user lacks permission', async () => {
      req.params = { organizationId: 'org-id' };
      req.user = { id: 'user-id', role: 'USER' };

      const existingOrg = {
        id: 'org-id',
        owners: [{ userId: 'other-user' }],
        createdBy: 'other-user',
      };

      mockPrisma.organization.findFirst.mockResolvedValue(existingOrg);

      await deleteOrganization(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to delete this organization',
      });
    });
  });

  describe('addOwners', () => {
    it('should add owners successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.user = { id: 'user-id', role: 'ADMIN' };
      req.body = { userIds: ['user-1', 'user-2'] };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
        createdBy: 'user-id',
      };

      const users = [
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
        },
        {
          id: 'user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@test.com',
        },
      ];

      const { addOwnersValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      addOwnersValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.organizationOwner.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 2 });
      mockCreateActivityLog.mockResolvedValue({});

      await addOwners(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Successfully added 2 owner(s) to the organization',
        data: expect.objectContaining({
          addedOwners: expect.arrayContaining([
            expect.objectContaining({ id: 'user-1', name: 'John Doe' }),
            expect.objectContaining({ id: 'user-2', name: 'Jane Smith' }),
          ]),
        }),
      });
    });

    it('should return error if validation fails', async () => {
      req.params = { organizationId: 'org-id' };
      req.body = { userIds: [] };

      const { addOwnersValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      addOwnersValidation.mockReturnValue({
        error: { details: [{ message: 'User IDs are required' }] },
      });

      await addOwners(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User IDs are required',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id' };
      req.body = { userIds: ['user-1'] };

      const { addOwnersValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      addOwnersValidation.mockReturnValue({ error: null });

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await addOwners(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });

    it('should return error if users not found', async () => {
      req.params = { organizationId: 'org-id' };
      req.body = { userIds: ['user-1', 'invalid-user'] };
      req.user = { id: 'user-id', role: 'ADMIN' };

      const organization = {
        id: 'org-id',
        owners: [{ userId: 'user-id' }],
        createdBy: 'user-id',
      };

      const { addOwnersValidation } = await import(
        '../../../validations/organization.validation.js'
      );
      addOwnersValidation.mockReturnValue({ error: null });

      // Clear previous mocks and set up new ones
      mockPrisma.organization.findFirst.mockReset();
      mockPrisma.user.findMany.mockReset();

      mockPrisma.organization.findFirst.mockResolvedValue(organization);

      // Only return one user even though we requested two
      const foundUsers = [
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(foundUsers);

      // Directly mock the response instead of letting it reach the catch block
      await addOwners(req, res, next);

      // Verify the correct response was sent
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          'One or more specified users do not exist. Please enter a valid user(s)',
        errors: {
          invalidUserIds: ['invalid-user'],
        },
      });
    });
  });

  describe('uploadOrganizationLogo', () => {
    it('should upload logo successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.user = { id: 'user-id' };
      req.file = {
        buffer: Buffer.from('test'),
        size: 1024,
        originalname: 'logo.png',
      };

      const organization = {
        id: organizationId,
        owners: [{ userId: 'user-id' }],
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockUploadToCloudinary.mockResolvedValue(
        'https://cloudinary.com/logo.jpg',
      );
      mockPrisma.organization.update.mockResolvedValue({
        id: organizationId,
        logoUrl: 'https://cloudinary.com/logo.jpg',
      });
      mockCreateActivityLog.mockResolvedValue({});

      await uploadOrganizationLogo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Organization logo uploaded successfully',
        logoUrl: 'https://cloudinary.com/logo.jpg',
        organization: expect.objectContaining({
          logoUrl: 'https://cloudinary.com/logo.jpg',
        }),
      });
    });

    it('should return error if no file uploaded', async () => {
      req.params = { organizationId: 'org-id' };
      req.file = null;

      await uploadOrganizationLogo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No file uploaded',
      });
    });

    it('should return error if organization not found', async () => {
      req.params = { organizationId: 'invalid-id' };
      req.file = { buffer: Buffer.from('test') };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await uploadOrganizationLogo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization not found',
      });
    });
  });

  describe('deleteOrganizationLogo', () => {
    it('should delete logo successfully', async () => {
      const organizationId = 'org-id';
      req.params = { organizationId };
      req.user = { id: 'user-id' };

      const organization = {
        id: organizationId,
        logoUrl: 'https://cloudinary.com/logo.jpg',
      };

      mockPrisma.organization.findFirst.mockResolvedValue(organization);
      mockDeleteFromCloudinary.mockResolvedValue({});
      mockPrisma.organization.update.mockResolvedValue({
        id: organizationId,
        logoUrl: null,
      });
      mockCreateActivityLog.mockResolvedValue({});

      await deleteOrganizationLogo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Organization logo deleted successfully',
        organization: expect.objectContaining({
          logoUrl: null,
        }),
      });
    });

    it('should return error if organization or logo not found', async () => {
      req.params = { organizationId: 'org-id' };

      mockPrisma.organization.findFirst.mockResolvedValue(null);

      await deleteOrganizationLogo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Organization logo not found',
      });
    });
  });

  describe('getAllOrganizationUsers', () => {
    it('should get all organization users successfully', async () => {
      const organizationId = 'org-id';
      req.params = { id: organizationId };

      const users = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          username: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          role: 'USER',
        },
        {
          id: 'user-2',
          email: 'user2@test.com',
          username: 'user2',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'ADMIN',
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(users);

      await getAllOrganizationUsers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: users,
      });
    });

    it('should return error if organization ID is missing', async () => {
      req.params = {};

      await getAllOrganizationUsers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing required field: id',
      });
    });
  });
});
