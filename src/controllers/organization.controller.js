import prisma from '../config/prismaClient.js';
import { sendEmail } from '../utils/email.utils.js';
import { generateOTP, hashOTP, validateOTP } from '../utils/otp.utils.js';
import {
  createOrganizationValidation,
  verifyOrganizationValidation,
} from '../validations/organization.validation.js';

/**
 * @swagger
 * /api/organization:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrganizationRequest'
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateOrganizationResponse'
 *       400:
 *         description: Bad request - Validation error
 *       409:
 *         description: Conflict - Organization already exists
 *       500:
 *         description: Server error
 */
export const createOrganization = async (req, res, next) => {
  try {
    const { error } = createOrganizationValidation(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      name,
      description,
      industry,
      sizeRange,
      website,
      logoUrl,
      address,
      contactEmail,
      contactPhone,
      orgOwnerId,
    } = req.body;

    const existingOrg = await prisma.organization.findFirst({
      where: {
        OR: [{ name }, { contactEmail }],
        deletedAt: null,
      },
    });
    if (existingOrg) {
      return res.status(409).json({
        message: 'Organization with this name or email already exists',
      });
    }

    // Determine if this is an admin creation (for status and verification)
    const isAdminCreation = req.user.role === 'ADMIN';

    // generate OTP
    const verificationOTP = generateOTP();
    const hashedOTP = await hashOTP(verificationOTP);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Use a transaction to ensure both organization and owner are created
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the organization
      const org = await tx.organization.create({
        data: {
          name,
          description,
          industry,
          sizeRange,
          website,
          logoUrl,
          address,
          contactEmail,
          contactPhone,
          status: isAdminCreation ? 'APPROVED' : 'PENDING',
          isVerified: isAdminCreation,
          createdBy: req.user.id,
          emailVerificationOTP: hashedOTP,
          emailVerificationExpires: otpExpiry,
        },
      });

      // 2. Create owner relationship
      const ownerId = orgOwnerId || req.user.id;
      const orgOwner = await tx.organizationOwner.create({
        data: {
          organizationId: org.id,
          userId: ownerId,
        },
      });

      return { org, orgOwner };
    });

    // Handle verification for non-admin creation
    if (!isAdminCreation && contactEmail) {
      try {
        // Send verification email
        await sendEmail({
          to: contactEmail,
          subject: 'Verify Your Organization Email',
          text: `Organization name: ${result.org.name}\nYour verification code is: ${verificationOTP}. will expire in 10 min`,
        });
      } catch (error) {
        next(error);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Organization created successfully. ${!isAdminCreation ? 'Please verify your org' : ''}`,
      data: {
        organization: {
          id: result.org.id,
          name: result.org.name,
          status: result.org.status,
          isVerified: result.org.isVerified,
        },
        organizationOwner: {
          id: result.orgOwner.id,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOrganization = async (req, res, next) => {
  try {
    const { error } = verifyOrganizationValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, otp } = req.body;

    const org = await prisma.organization.findFirst({
      where: { contactEmail: email }, // TODO: make email must entered in prisma and unique
    });

    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check OTP
    if (
      !(await validateOTP(otp, org.emailVerificationOTP)) ||
      org.emailVerificationExpires < new Date()
    ) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Activate user and clear verification tokens
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        isVerified: true,
        status: 'APPROVAL',
        emailVerificationOTP: null,
        emailVerificationExpires: null,
      },
    });

    return res
      .status(200)
      .json({ message: 'Organization verified successfully' });
  } catch (error) {
    next(error);
  }
};

export const getAllOrganizations = async (req, res, next) => {
  try {
    // Destructure and parse query params with defaults
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      ...filters
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build base where clause
    const where = {
      deletedAt: null,
      ...(filters.name && {
        name: { contains: filters.name, mode: 'insensitive' },
      }),
      ...(filters.industry && { industry: filters.industry }),
      ...(filters.sizeRange && { sizeRange: filters.sizeRange }),
      ...(filters.status && { status: filters.status }),
      ...(filters.isVerified !== undefined && {
        isVerified: filters.isVerified === 'true',
      }),
    };

    // Execute queries in parallel
    const [totalCount, organizations] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        orderBy: { [sortBy]: sortOrder.toLowerCase() },
        skip,
        take: limitNum,
        include: {
          _count: {
            select: {
              users: true,
              departments: true,
              teams: true,
              projects: true,
            },
          },
          owners: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Format response
    const response = {
      success: true,
      message: 'Organizations retrieved successfully',
      data: {
        organizations: organizations.map((org) => ({
          ...org,
          statistics: {
            usersCount: org._count.users,
            departmentsCount: org._count.departments,
            teamsCount: org._count.teams,
            projectsCount: org._count.projects,
          },
          owners: org.owners.map((owner) => ({
            id: owner.user.id,
            name: `${owner.user.firstName} ${owner.user.lastName}`,
            email: owner.user.email,
          })),
          _count: undefined, // Remove the original _count field
        })),
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum),
        },
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
