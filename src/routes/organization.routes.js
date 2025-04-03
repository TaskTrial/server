import { Router } from 'express';
import {
  createOrganization,
  verifyOrganization,
} from '../controllers/organization.controller.js';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';

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

export default router;
