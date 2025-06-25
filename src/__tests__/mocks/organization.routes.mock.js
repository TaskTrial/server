import express from 'express';
import { mockAuthMiddleware } from './middleware.mock.js';

const router = express.Router();

// Mock organization controller functions
export const mockOrganizationController = {
  createOrganization: (req, res) => {
    const { name, contactEmail } = req.body;

    if (!name || !contactEmail) {
      return res
        .status(400)
        .json({ message: 'Name and contact email are required' });
    }

    const orgId = 'mock-org-id';
    const joinCode = 'MOCK1234';

    return res.status(201).json({
      success: true,
      message: 'Organization created successfully.',
      data: {
        organization: {
          id: orgId,
          name,
          status: 'APPROVED',
          isVerified: true,
          joinCode,
        },
        organizationOwner: {
          id: 'mock-owner-id',
        },
      },
    });
  },

  joinToOrg: (req, res) => {
    const { joinCode } = req.body;

    if (!joinCode) {
      return res.status(400).json({ message: 'Join code is required' });
    }

    if (joinCode !== 'MOCK1234') {
      return res
        .status(404)
        .json({ message: 'Invalid join code or organization not found' });
    }

    return res.status(200).json({
      message: 'Successfully joined organization',
      organization: {
        id: 'mock-org-id',
        name: 'Test Organization',
        industry: 'Technology',
        sizeRange: '1-10',
        logoUrl: null,
      },
    });
  },

  userOrgStatus: (req, res) => {
    const hasOrg = req.query.hasOrg === 'true';

    if (hasOrg) {
      return res.status(200).json({
        hasOrganization: true,
        isOwner: req.query.isOwner === 'true',
        organization: {
          id: 'mock-org-id',
          name: 'Test Organization',
          industry: 'Technology',
          sizeRange: '1-10',
          logoUrl: null,
        },
      });
    }

    return res.status(200).json({ hasOrganization: false });
  },

  getAllOrganizations: (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Organizations retrieved successfully',
      data: {
        organizations: [
          {
            id: 'mock-org-id',
            name: 'Test Organization',
            industry: 'Technology',
            sizeRange: '1-10',
            statistics: {
              usersCount: 5,
              departmentsCount: 2,
              teamsCount: 3,
              projectsCount: 4,
            },
            owners: [
              {
                id: 'mock-user-id',
                name: 'Test User',
                email: 'test@example.com',
              },
            ],
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          pages: 1,
        },
      },
    });
  },

  updateOrganization: (req, res) => {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      data: {
        id: organizationId,
        name: req.body.name || 'Updated Organization',
        description: req.body.description || 'Updated description',
        industry: req.body.industry || 'Technology',
        sizeRange: req.body.sizeRange || '1-10',
        status: 'APPROVED',
        isVerified: true,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  deleteOrganization: (req, res) => {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Organization deleted successfully',
    });
  },
};

// Apply mock controller to routes
router.use(mockAuthMiddleware);
router.post('/', mockOrganizationController.createOrganization);
router.post('/join', mockOrganizationController.joinToOrg);
router.get('/status', mockOrganizationController.userOrgStatus);
router.get('/all', mockOrganizationController.getAllOrganizations);
router.put('/:organizationId', mockOrganizationController.updateOrganization);
router.delete(
  '/:organizationId',
  mockOrganizationController.deleteOrganization,
);

export default router;
