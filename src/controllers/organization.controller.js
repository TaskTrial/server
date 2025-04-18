import prisma from '../config/prismaClient.js';
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from '../utils/cloudinary.utils.js';
import { sendEmail } from '../utils/email.utils.js';
import { generateOTP, hashOTP, validateOTP } from '../utils/otp.utils.js';
import {
  addOwnersValidation,
  createOrganizationValidation,
  updateOrganizationValidation,
  verifyOrganizationValidation,
} from '../validations/organization.validation.js';
import {
  createActivityLog,
  generateActivityDetails,
} from '../utils/activityLogs.utils.js';

/**
 * @desc   Create a new organization with the current user as owner
 * @route  /api/organization
 * @method POST
 * @access private
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
          status: 'APPROVED',
          isVerified: true,
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

      // 3. Update the creator's organizationId
      const updatedUser = await tx.user.update({
        where: { id: ownerId },
        data: {
          organizationId: org.id,
          isOwner: true, // Set the user as owner if appropriate
        },
      });

      return { org, orgOwner, updatedUser };
    });

    // Handle verification for non-admin creation
    // if (!isAdminCreation && contactEmail) {
    //   try {
    //     // Send verification email
    //     await sendEmail({
    //       to: contactEmail,
    //       subject: 'Verify Your Organization Email',
    //       text: `Organization name: ${result.org.name}\nYour verification code is: ${verificationOTP}. will expire in 10 min`,
    //     });
    //   } catch (error) {
    //     return res.status(500).json({
    //       success: false,
    //       error,
    //       message: 'Failed to send verification email. Please try again later.',
    //     });
    //   }
    // }

    // Log organization creation
    await createActivityLog({
      entityType: 'ORGANIZATION',
      action: 'CREATED',
      userId: req.user.id,
      organizationId: result.org.id,
      details: generateActivityDetails('CREATED', null, {
        organizationName: result.org.name,
        organizationId: result.org.id,
        createdAt: result.org.createdAt,
      }),
    });

    return res.status(201).json({
      success: true,
      message: `Organization created successfully.`,
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

/**
 * @desc   Resend OTP code if it expired
 * @route  /api/organization/resendOTP/:orgId
 * @method POST
 * @access private
 */
export const resendOTP = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // generate OTP
    const verificationOTP = generateOTP();
    const hashedOTP = await hashOTP(verificationOTP);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        emailVerificationOTP: hashedOTP,
        emailVerificationExpires: otpExpiry,
      },
    });

    try {
      // Send verification email
      await sendEmail({
        to: org.contactEmail,
        subject: 'Re-verify Your Organization Email',
        text: `Organization name: ${org.name}\nYour verification code is: ${verificationOTP}. It will expire in 10 minutes`,
      });
    } catch (emailError) {
      return res.status(500).json({
        success: false,
        error: emailError,
        message: 'Failed to send verification email. Please try again later.',
      });
    }

    // Log OTP resend
    await createActivityLog({
      entityType: 'ORGANIZATION',
      action: 'UPDATED',
      userId: req.user.id,
      organizationId: orgId,
      details: {
        action: 'OTP_RESENT',
        timestamp: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Code send successfully. Please check your email',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Verify organization's contact email using OTP
 * @route  /api/organization/verifyOrg
 * @method POST
 * @access private
 */
export const verifyOrganization = async (req, res, next) => {
  try {
    const { error } = verifyOrganizationValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { orgId } = req.params;
    const { otp } = req.body;

    const org = await prisma.organization.findFirst({
      where: { id: orgId },
    });

    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (org.isVerified) {
      return res
        .status(200)
        .json({ message: 'Organization is already verified' });
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

    // Log organization verification
    await createActivityLog({
      entityType: 'ORGANIZATION',
      action: 'UPDATED',
      userId: req.user.id,
      organizationId: org.id,
      details: {
        action: 'VERIFIED',
        verifiedAt: org.isVerified,
      },
    });

    return res
      .status(200)
      .json({ message: 'Organization verified successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get paginated list of organizations with filtering and sorting
 * @route  /api/organization/all
 * @method GET
 * @access private
 */
export const getAllOrganizations = async (req, res, next) => {
  try {
    // Parse query parameters
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

    // Build filters
    const where = { deletedAt: null };

    // Apply text search
    if (filters.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }

    // Apply direct filters
    ['industry', 'sizeRange', 'status'].forEach((field) => {
      if (filters[field]) {
        where[field] = filters[field];
      }
    });

    // Handle boolean filter
    if (filters.isVerified !== undefined) {
      if (['true', '1', true].includes(filters.isVerified)) {
        where.isVerified = true;
      } else if (['false', '0', false].includes(filters.isVerified)) {
        where.isVerified = false;
      }
    }

    // Add permission filters for non-admin users
    if (req.user.role !== 'ADMIN') {
      where.OR = [
        { createdBy: req.user.id },
        { users: { some: { id: req.user.id } } },
        { owners: { some: { userId: req.user.id } } },
      ];
    }

    // Fetch data and count in parallel
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
    return res.status(200).json({
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
          _count: undefined,
        })),
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get detailed information about a specific organization
 * @route  /api/organization/:organizationId
 * @method GET
 * @access private
 */
export const getSpecificOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Find organization with all related data
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      include: {
        owners: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePic: true,
              },
            },
          },
        },
        departments: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            _count: {
              select: { teams: true, users: true },
            },
          },
          take: 5,
        },
        teams: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            _count: {
              select: { members: true, projects: true },
            },
          },
          take: 5,
        },
        projects: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            startDate: true,
            endDate: true,
          },
          take: 5,
        },
        _count: {
          select: {
            users: true,
            departments: true,
            teams: true,
            projects: true,
            templates: true,
          },
        },
        users: {
          where: {
            id: req.user.id,
          },
          take: 1,
        },
      },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check permissions for non-admin users
    if (req.user.role !== 'ADMIN') {
      // Check if user is an owner
      const isOwner = organization.owners.some(
        (owner) => owner.user.id === req.user.id,
      );

      // Check if user is a member
      const isMember = organization.users.some(
        (user) => user.id === req.user.id,
      );

      if (!isOwner && !isMember) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this organization',
        });
      }
    }

    // Format and return response
    return res.status(200).json({
      success: true,
      message: 'Organization retrieved successfully',
      data: {
        ...organization,
        statistics: {
          usersCount: organization._count.users,
          departmentsCount: organization._count.departments,
          teamsCount: organization._count.teams,
          projectsCount: organization._count.projects,
          templatesCount: organization._count.templates,
        },
        owners: organization.owners.map((owner) => ({
          id: owner.user.id,
          name: `${owner.user.firstName} ${owner.user.lastName}`,
          email: owner.user.email,
          profileImage: owner.user.profilePic,
        })),
        teams: organization.teams.map((team) => ({
          ...team,
          usersCount: team._count.members,
          projectsCount: team._count.projects,
          _count: undefined,
        })),
        hasMoreDepartments: organization._count.departments > 5,
        hasMoreTeams: organization._count.teams > 5,
        hasMoreProjects: organization._count.projects > 5,
        _count: undefined,
        users: undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update organization details
 * @route  /api/organization/:organizationId
 * @method PUT
 * @access private
 */
export const updateOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Validate input data
    const { error, value } = updateOrganizationValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message),
      });
    }

    // Check if organization exists and is not deleted
    const existingOrg = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      include: {
        owners: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check permissions - only admins and organization owners can update
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isCreator = existingOrg.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this organization',
      });
    }

    // For non-admins, prevent updating certain fields
    const updateData = { ...value };
    if (!isAdmin) {
      // Non-admins can't change verification status or approval status
      delete updateData.isVerified;
      delete updateData.status;
    }

    // Check if updating to an existing organization name
    if (updateData.name && updateData.name !== existingOrg.name) {
      const nameExists = await prisma.organization.findFirst({
        where: {
          name: updateData.name,
          id: { not: organizationId },
          deletedAt: null,
        },
      });

      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: 'Organization with this name already exists',
        });
      }
    }

    // If there's a change in contact email and user is not an admin,
    // reset verification if needed
    if (
      !isAdmin &&
      updateData.contactEmail &&
      updateData.contactEmail !== existingOrg.contactEmail
    ) {
      updateData.isVerified = false;
    }

    // Update the organization
    const updatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    // If email changed and verification was reset, send verification email
    if (
      !isAdmin &&
      updateData.contactEmail &&
      updateData.contactEmail !== existingOrg.contactEmail
    ) {
      try {
        const verificationOTP = generateOTP();
        const hashedOTP = await hashOTP(verificationOTP);

        // Update the database with the new verification data
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            emailVerificationOTP: hashedOTP,
            emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
            isVerified: false,
            status: 'PENDING',
          },
        });

        // Send verification email
        await sendEmail({
          to: value.contactEmail,
          subject: 'Verify Your Updated Organization Email',
          text: `Organization name: ${updateData.name}\nYour verification code is: ${verificationOTP}. will expire in 10 min`,
        });
      } catch (emailError) {
        return res.status(500).json({
          success: false,
          message: 'Organization updated but failed to send verification email',
          error: emailError.message, // You can remove this in production
        });
      }
    }

    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
    });

    // Log organization update
    await createActivityLog({
      entityType: 'ORGANIZATION',
      action: 'UPDATED',
      userId: req.user.id,
      organizationId: organizationId,
      details: generateActivityDetails(
        'UPDATED',
        existingOrg,
        updatedOrganization,
      ),
    });

    return res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      note:
        updateData.contactEmail !== existingOrg.contactEmail
          ? 'Please verify your organization email'
          : '',
      data: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        description: updatedOrg.description,
        industry: updatedOrg.industry,
        sizeRange: updatedOrg.sizeRange,
        website: updatedOrg.website,
        logoUrl: updatedOrg.logoUrl,
        status: updatedOrg.status,
        isVerified: updatedOrg.isVerified,
        contactEmail: updatedOrg.contactEmail,
        contactPhone: updatedOrg.contactPhone,
        address: updatedOrg.address,
        updatedAt: updatedOrg.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Soft delete an organization (marks as deleted but retains in database)
 * @route  /api/organization/:organizationId
 * @method DELETE
 * @access private
 */
export const deleteOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Check if organization exists and is not already deleted
    const existingOrg = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      include: {
        owners: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!existingOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found or already deleted',
      });
    }

    // Check permissions - only admins and organization owners can delete
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = existingOrg.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isCreator = existingOrg.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this organization',
      });
    }

    // delete the organization
    await prisma.organization.update({
      where: { id: organizationId },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });

    // Log organization deletion
    await createActivityLog({
      entityType: 'ORGANIZATION',
      action: 'DELETED',
      userId: req.user.id,
      organizationId: organizationId,
      details: generateActivityDetails('DELETED', existingOrg, {
        deletedAt: new Date(),
        organizationName: existingOrg.name,
      }),
    });

    return res.status(200).json({
      success: true,
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Add one or more users as owners to an organization.
 * @route  /api/organization/:organizationId/addOwner
 * @method POST
 * @access private - Requires admin or existing owner permissions.
 */
export const addOwners = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    // Validate organizationId
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    const { error } = addOwnersValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { userIds } = req.body;

    // Check if organization exists and is not deleted
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      include: {
        owners: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check permissions - only admins and organization owners can delete
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = organization.owners.some(
      (owner) => owner.userId === req.user.id,
    );
    const isCreator = organization.createdBy === req.user.id;

    if (!isAdmin && !isOwner && !isCreator) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have permission to add new owners to this organization',
      });
    }

    // Get existing owner user IDs
    const existingOwnerIds = organization.owners.map((owner) => owner.userId);

    // Filter out users who are already owners
    const newOwnerIds = userIds.filter((id) => !existingOwnerIds.includes(id));

    if (newOwnerIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All specified users are already owners of this organization',
        data: {
          addedOwners: [],
          skippedOwners: userIds,
        },
      });
    }

    // Verify all users exist in the system
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: newOwnerIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (users.length !== newOwnerIds.length) {
      const foundUserIds = users.map((user) => user.id);
      const notFoundUserIds = newOwnerIds.filter(
        (id) => !foundUserIds.includes(id),
      );

      return res.status(400).json({
        success: false,
        message:
          'One or more specified users do not exist. Please enter a valid user(s)',
        errors: {
          invalidUserIds: notFoundUserIds,
        },
      });
    }

    // Create new owner relationships
    const newOwnerRecords = await prisma.organizationOwner.createMany({
      data: newOwnerIds.map((userId) => ({
        organizationId,
        userId,
      })),
      skipDuplicates: true,
    });

    await prisma.user.updateMany({
      where: {
        id: {
          in: newOwnerIds,
        },
      },
      data: {
        organizationId: organizationId,
        isOwner: true,
      },
    });
    // Send email notifications to new owners

    // Log addition of owners
    await createActivityLog({
      entityType: 'ORGANIZATION',
      action: 'MEMBER_ADDED',
      userId: req.user.id,
      organizationId: organizationId,
      details: {
        newOwnerRecords,
        addedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully added ${newOwnerRecords.count} owner(s) to the organization`,
      data: {
        addedOwners: users.map((user) => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        })),
        skippedOwners: userIds.filter((id) => existingOwnerIds.includes(id)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Upload Organization Logo
 * @route  /api/organization/:organizationId/logo/upload
 * @method POST
 * @access private - Requires admin or existing owner permissions.
 */
export const uploadOrganizationLogo = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    // Validate organizationId
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Check if organization exists and is not deleted
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      include: {
        owners: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const logoUrl = await uploadToCloudinary(
      req.file.buffer,
      'organization_logos',
    );

    // Update organization logo URL in database
    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl },
    });

    // Log logo upload
    await createActivityLog({
      entityType: 'ORGANIZATION',
      action: 'UPDATED',
      userId: req.user.id,
      organizationId: organizationId,
      details: {
        action: 'LOGO_UPLOADED',
        logoUrl: updatedOrganization.logoUrl,
        fileSize: req.file.size,
        fileName: req.file.originalname,
        uploadedAt: updatedOrganization.updatedAt,
      },
    });

    res.status(200).json({
      message: 'Organization logo uploaded successfully',
      logoUrl,
      organization: updatedOrganization,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete Organization Logo
 * @route  /api/organization/:organizationId/logo/delete
 * @method DELETE
 * @access private - Requires admin or existing owner permissions.
 */
export const deleteOrganizationLogo = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    // Validate organizationId
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    const organization = await prisma.organization.findFirst({
      where: { id: organizationId },
    });

    if (!organization || !organization.logoUrl) {
      return res.status(404).json({ message: 'Organization logo not found' });
    }

    await deleteFromCloudinary(organization.logoUrl);

    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl: null },
    });

    // Log logo deletion
    await createActivityLog({
      entityType: 'ORGANIZATION',
      action: 'UPDATED',
      userId: req.user.id,
      organizationId: organizationId,
      details: {
        action: 'LOGO_DELETED',
        previousLogoUrl: organization.logoUrl,
        deletedAt: updatedOrganization.updatedAt,
      },
    });

    res.status(200).json({
      message: 'Organization logo deleted successfully',
      organization: updatedOrganization,
    });
  } catch (error) {
    next(error);
  }
};
