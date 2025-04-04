import prisma from '../config/prismaClient.js';
import { updateUserAccountValidation } from '../validations/user.validation.js';
/* eslint no-undef:off */
export const getAllUsers = async (req, res, next) => {
  try {
    // Fetch all users from the database
    const users = await prisma.user.findMany({
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
      users,
    });
  } catch (error) {
    next(error); // Ensure next is called with the error
  }
};

export const getUserById = async (req, res, next) => {
  const { id } = req.params;
  try {
    // Ensure req.user is defined
    const user = await prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      return next(error); // Ensure next is called with the error
    }

    return res.status(200).json(user);
  } catch (error) {
    next(error); // Ensure next is called with the error
  }
};

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
      updateData.phoneNumber = encrypt(value.phoneNumber);
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
