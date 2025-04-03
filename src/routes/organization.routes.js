import { Router } from 'express';
import { createOrganization } from '../controllers/organization.controller.js';
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

export default router;
