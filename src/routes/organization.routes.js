import { Router } from 'express';
import {
  addOwners,
  createOrganization,
  deleteOrganization,
  getAllOrganizations,
  getSpecificOrganization,
  updateOrganization,
  verifyOrganization,
} from '../controllers/organization.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { verifyAdminPermission } from '../middlewares/verifyAdminPermission.middleware.js';

const router = Router();

router.post('/api/organization', verifyAccessToken, createOrganization);
router.post(
  '/api/organization/verifyOrg',
  verifyAccessToken,
  verifyOrganization,
);
router.get(
  '/api/organization/all',
  verifyAccessToken,
  verifyAdminPermission,
  getAllOrganizations,
);
router.get(
  '/api/organization/:organizationId',
  verifyAccessToken,
  verifyAdminPermission,
  getSpecificOrganization,
);
router.put(
  '/api/organization/:organizationId',
  verifyAccessToken,
  verifyAdminPermission,
  updateOrganization,
);
router.delete(
  '/api/organization/:organizationId',
  verifyAccessToken,
  deleteOrganization,
);
router.post(
  '/api/organization/:organizationId/addOwner',
  verifyAccessToken,
  addOwners,
);

export default router;
