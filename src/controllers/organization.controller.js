import prisma from '../config/prismaClient.js';
import { sendEmail } from '../utils/email.utils.js';
import { generateOTP, hashOTP } from '../utils/otp.utils.js';
import { creatOrganizationValidation } from '../validations/organization.validation.js';

export const creatOrganization = async (req, res, next) => {
  try {
    const { error } = creatOrganizationValidation(req.body);
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
          createdBy: req.id,
          emailVerificationOTP: hashedOTP,
          emailVerificationExpires: otpExpiry,
        },
      });

      // 2. Create owner relationship
      const ownerId = orgOwnerId || req.id;
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
          text: `Organization name: ${result.org.name}\nYour verification code is: ${verificationOTP}. will expired in 10 min`,
        });
      } catch (error) {
        next(error);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Organization created successfully',
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
