import prisma from '../config/prismaClient.js';
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from '../utils/cloudinary.utils.js';
import { comparePassword, hashPassword } from '../utils/password.utils.js';
import {
  updatePasswordValidation,
  updateUserAccountValidation,
} from '../validations/user.validation.js';

/**
 * @desc   Get all users with pagination
 * @route  GET /api/users/all?page=1
 * @method GET
 * @access Private (Admin only)
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get total number of users
    const totalUsers = await prisma.user.count();

    // Fetch users with pagination
    const users = await prisma.user.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return res.status(200).json({
      message: 'Users retrieved successfully',
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Get full user profile by ID
 * @route  GET /api/users/:id
 * @method GET
 * @access Private (User or Admin)
 */
export const getUserById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        profilePic: true,
        phoneNumber: true,
        jobTitle: true,
        timezone: true,
        bio: true,
        preferences: true,
        isActive: true,
        isOwner: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true, // Keep valid fields
        // Removed invalid field `lastLogout`
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        permissions: {
          select: {
            entityType: true,
            entityId: true,
            permissions: true,
          },
        },
        teamMemberships: {
          select: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        activityLogs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      message: 'User retrieved successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update user account
 * @route  PUT /api/users/:id
 * @method PUT
 * @access Private (User or Admin)
 */
export const updateUserAccount = async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const { error, value } = updateUserAccountValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is not active' });
    }

    const updateData = {};

    // Update basic profile fields
    if (value.firstName) {
      updateData.firstName = value.firstName;
    }
    if (value.lastName) {
      updateData.lastName = value.lastName;
    }
    if (value.phoneNumber) {
      updateData.phoneNumber = value.phoneNumber;
    }
    if (value.jobTitle) {
      updateData.jobTitle = value.jobTitle;
    }
    if (value.timezone) {
      updateData.timezone = value.timezone;
    }
    if (value.bio) {
      updateData.bio = value.bio;
    }

    // Admin-only fields
    if (req.user.role === 'ADMIN') {
      if (value.role) {
        updateData.role = value.role;
      }
      if (value.departmentId) {
        updateData.departmentId = value.departmentId;
      }
      if (value.organizationId) {
        updateData.organizationId = value.organizationId;
      }

      // Set updatedBy if admin is modifying another user
      if (req.user.id !== userId) {
        updateData.updatedBy = req.user.id;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phoneNumber: true,
        jobTitle: true,
        timezone: true,
        bio: true,
        departmentId: true,
        organizationId: true,
        profilePic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      message: 'User account updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Update user password
 * @route  PUT /api/users/update-password/:id
 * @method PUT
 * @access Private (User only)
 */
export const updateUserPassword = async (req, res, next) => {
  try {
    // Validate the request body
    const { error, value } = updatePasswordValidation(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { id } = req.params; // Extract user ID from request parameters
    const { oldPassword, newPassword } = value;

    // Fetch the user by ID
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, password: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare the old password with the stored password
    const isMatch = await comparePassword(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    // Ensure the new password is different from the old password
    if (oldPassword === newPassword) {
      return res
        .status(400)
        .json({ message: 'New password must be different from the old one' });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the user's password in the database
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // Respond with a success message
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    // Pass any errors to the error-handling middleware
    next(error);
  }
};

/**
 * @desc   Soft delete a user
 * @route  DELETE /api/users/:id
 * @method DELETE
 * @access Private (Admin only)
 */
export const softDeleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({ where: { id } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.deletedAt) {
      return res.status(400).json({ message: 'User already deleted' });
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return res.status(200).json({ message: 'User soft-deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Restore a soft-deleted user
 * @route  PATCH /api/users/restore/:id
 * @method PATCH
 * @access Private (Admin only)
 */
export const restoreUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user || !user.deletedAt) {
      return res.status(404).json({ message: 'User not found or not deleted' });
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
      },
    });

    return res.status(200).json({ message: 'User restored successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Upload a profile picture for a user
 * @route  POST /api/users/:id/profile-picture
 * @method POST
 * @access Private (User or Admin)
 */
export const uploadUserProfilePic = async (req, res, next) => {
  try {
    const { userId } = req.params; // Ensure `userId` matches the route parameter

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Check if user exists and is not deleted
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const profilePicUrl = await uploadToCloudinary(
      req.file.buffer,
      'profile_pictures',
    );

    // Update user profile picture URL in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePic: profilePicUrl },
    });

    res.status(200).json({
      message: 'Profile picture uploaded successfully',
      profilePicUrl,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc   Delete User Profile Picture
 * @route  /api/users/:userId/profile-pic/delete
 * @method DELETE
 * @access private - Requires admin or user himself
 */
export const deleteUserProfilePic = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Check if user exists and is not deleted
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user || !user.profilePic) {
      return res.status(404).json({ message: 'Profile picture not found' });
    }

    await deleteFromCloudinary(user.profilePic);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePic: null },
    });

    res.status(200).json({
      message: 'Profile picture deleted successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
