import { Router } from 'express';
import {
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

/**
 * @swagger
 * tags:
 *   name: Organization
 *   description: Organization management endpoints
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     CreateOrganizationRequest:
 *       type: object
 *       required:
 *         - name
 *         - contactEmail
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the organization
 *         description:
 *           type: string
 *           description: Description of the organization
 *         industry:
 *           type: string
 *           description: Industry sector
 *         sizeRange:
 *           type: string
 *           description: Organization size (e.g., 1-10 employees)
 *         website:
 *           type: string
 *           format: uri
 *           description: Organization website URL
 *         logoUrl:
 *           type: string
 *           format: uri
 *           description: URL of the organization logo
 *         address:
 *           type: string
 *           description: Organization address
 *         contactEmail:
 *           type: string
 *           format: email
 *           description: Contact email for the organization
 *         contactPhone:
 *           type: string
 *           description: Contact phone number
 *         orgOwnerId:
 *           type: string
 *           description: ID of the organization owner (optional)
 *     CreateOrganizationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             organization:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *                 isVerified:
 *                   type: boolean
 *             organizationOwner:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 */
router.post('/api/organization', verifyAccessToken, createOrganization);

/**
 * @swagger
 * /api/organization/verifyOrg:
 *   post:
 *     summary: Verify an organization's email using OTP
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Organization's registered contact email
 *               otp:
 *                 type: string
 *                 description: The OTP sent to the organization's email
 *     responses:
 *       200:
 *         description: Organization verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: Organization not found
 *       500:
 *         description: Server error
 */
router.post(
  '/api/organization/verifyOrg',
  verifyAccessToken,
  verifyOrganization,
);

/**
 * @swagger
 * /api/organization/all:
 *   get:
 *     summary: Retrieve all organizations with pagination, filtering, and sorting
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of organizations per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, name, industry, status]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sorting order
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter organizations by name (partial match)
 *       - in: query
 *         name: industry
 *         schema:
 *           type: string
 *         description: Filter organizations by industry
 *       - in: query
 *         name: sizeRange
 *         schema:
 *           type: string
 *         description: Filter organizations by size range
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter organizations by status
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *         description: Filter organizations by verification status
 *     responses:
 *       200:
 *         description: Successfully retrieved organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     organizations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           industry:
 *                             type: string
 *                           sizeRange:
 *                             type: string
 *                           status:
 *                             type: string
 *                           isVerified:
 *                             type: boolean
 *                           statistics:
 *                             type: object
 *                             properties:
 *                               usersCount:
 *                                 type: integer
 *                               departmentsCount:
 *                                 type: integer
 *                               teamsCount:
 *                                 type: integer
 *                               projectsCount:
 *                                 type: integer
 *                           owners:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 name:
 *                                   type: string
 *                                 email:
 *                                   type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized - No token provided
 *       403:
 *         description: Forbidden - Only admins can access this endpoint
 *       500:
 *         description: Server error
 */
router.get(
  '/api/organization/all',
  verifyAccessToken,
  verifyAdminPermission,
  getAllOrganizations,
);

/**
 * @swagger
 * /api/organization/{organizationId}:
 *   get:
 *     summary: Retrieve details of a specific organization
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the organization to retrieve
 *     responses:
 *       200:
 *         description: Successfully retrieved organization details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Organization retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     industry:
 *                       type: string
 *                     sizeRange:
 *                       type: string
 *                     website:
 *                       type: string
 *                     logoUrl:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [PENDING, APPROVED, REJECTED]
 *                     isVerified:
 *                       type: boolean
 *                     contactEmail:
 *                       type: string
 *                     contactPhone:
 *                       type: string
 *                     address:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         usersCount:
 *                           type: integer
 *                         departmentsCount:
 *                           type: integer
 *                         teamsCount:
 *                           type: integer
 *                         projectsCount:
 *                           type: integer
 *                         templatesCount:
 *                           type: integer
 *                     owners:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           profileImage:
 *                             type: string
 *                     departments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           teamsCount:
 *                             type: integer
 *                           usersCount:
 *                             type: integer
 *                     teams:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           usersCount:
 *                             type: integer
 *                           projectsCount:
 *                             type: integer
 *                     projects:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [ACTIVE, COMPLETED, ON_HOLD]
 *                           startDate:
 *                             type: string
 *                             format: date-time
 *                           endDate:
 *                             type: string
 *                             format: date-time
 *                     hasMoreDepartments:
 *                       type: boolean
 *                     hasMoreTeams:
 *                       type: boolean
 *                     hasMoreProjects:
 *                       type: boolean
 *       400:
 *         description: Bad request - Missing or invalid organization ID
 *       401:
 *         description: Unauthorized - No token provided
 *       403:
 *         description: Forbidden - User does not have permission to view this organization
 *       404:
 *         description: Not found - Organization not found
 *       500:
 *         description: Server error
 */
router.get(
  '/api/organization/:organizationId',
  verifyAccessToken,
  verifyAdminPermission,
  getSpecificOrganization,
);

/**
 * @swagger
 * /api/organization/{organizationId}:
 *   put:
 *     summary: Update an organization's details
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the organization to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Tech Innovations Ltd."
 *               description:
 *                 type: string
 *                 example: "A leading software development company."
 *               industry:
 *                 type: string
 *                 example: "Technology"
 *               sizeRange:
 *                 type: string
 *                 example: "50-200"
 *               website:
 *                 type: string
 *                 example: "https://techinnovations.com"
 *               logoUrl:
 *                 type: string
 *                 example: "https://cdn.techinnovations.com/logo.png"
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *                 example: "APPROVED"
 *               isVerified:
 *                 type: boolean
 *                 example: true
 *               contactEmail:
 *                 type: string
 *                 example: "contact@techinnovations.com"
 *               contactPhone:
 *                 type: string
 *                 example: "+1-234-567-890"
 *               address:
 *                 type: string
 *                 example: "123 Silicon Valley, CA, USA"
 *     responses:
 *       200:
 *         description: Successfully updated the organization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Organization updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     industry:
 *                       type: string
 *                     sizeRange:
 *                       type: string
 *                     website:
 *                       type: string
 *                     logoUrl:
 *                       type: string
 *                     status:
 *                       type: string
 *                     isVerified:
 *                       type: boolean
 *                     contactEmail:
 *                       type: string
 *                     contactPhone:
 *                       type: string
 *                     address:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - Validation error or missing required fields
 *       401:
 *         description: Unauthorized - No token provided
 *       403:
 *         description: Forbidden - User does not have permission to update the organization
 *       404:
 *         description: Not found - Organization not found
 *       409:
 *         description: Conflict - Organization with the same name already exists
 *       500:
 *         description: Server error
 */
router.put(
  '/api/organization/:organizationId',
  verifyAccessToken,
  verifyAdminPermission,
  updateOrganization,
);

/**
 * @swagger
 * /api/organization/{organizationId}:
 *   delete:
 *     summary: Delete an organization
 *     description: Soft delete an organization by setting `deletedAt` and updating the status to `DELETED`. Only admins, owners, or the creator can perform this action.
 *     tags:
 *       - Organization
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         description: ID of the organization to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Organization deleted successfully
 *       400:
 *         description: Missing or invalid organization ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Organization ID is required
 *       403:
 *         description: Permission denied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: You do not have permission to delete this organization
 *       404:
 *         description: Organization not found or already deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Organization not found or already deleted
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/api/organization/:organizationId',
  verifyAccessToken,
  deleteOrganization,
);

export default router;
