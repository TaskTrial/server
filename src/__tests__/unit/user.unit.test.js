/* eslint-env node */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
const prisma = require('../../config/prismaClient.js').default;
import {
  getAllUsers,
  getUserById,
  updateUserAccount,
  updateUserPassword,
  softDeleteUser,
  restoreUser,
  uploadUserProfilePic,
  deleteUserProfilePic,
} from '../../controllers/user.controller.js';
import {
  mockHashPassword,
  mockComparePassword,
  mockUploadToCloudinary,
  mockDeleteFromCloudinary,
  mockCreateActivityLog,
  mockGenerateActivityDetails,
} from '../setup.js';

/* eslint no-undef: off */

// Mock validation schemas
jest.mock('../../validations/user.validation.js', () => ({
  updateUserAccountValidation: jest.fn(),
  updatePasswordValidation: jest.fn(),
}));

describe('User Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should get all users with pagination', async () => {
      req.query = { page: '2' };

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'MEMBER',
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'ADMIN',
        },
      ];

      prisma.user.count.mockResolvedValue(25);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      await getAllUsers(req, res, next);

      expect(prisma.user.count).toHaveBeenCalled();
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        skip: 10, // (page - 1) * limit
        take: 10, // default limit
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Users retrieved successfully',
        currentPage: 2,
        totalPages: 3, // Math.ceil(25 / 10)
        totalUsers: 25,
        users: mockUsers,
      });
    });

    it('should handle default pagination when page is not provided', async () => {
      req.query = {};

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'MEMBER',
        },
      ];

      prisma.user.count.mockResolvedValue(5);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      await getAllUsers(req, res, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        skip: 0, // (page - 1) * limit where page = 1
        take: 10, // default limit
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Users retrieved successfully',
        currentPage: 1,
        totalPages: 1, // Math.ceil(5 / 10)
        totalUsers: 5,
        users: mockUsers,
      });
    });

    it('should handle errors and pass to next middleware', async () => {
      const error = new Error('Database error');
      prisma.user.count.mockRejectedValue(error);

      await getAllUsers(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      req.params = { id: 'user-id' };

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'MEMBER',
        profilePic: 'profile.jpg',
        isActive: true,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      await getUserById(req, res, next);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-id', deletedAt: null },
        select: expect.objectContaining({
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          profilePic: true,
        }),
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User retrieved successfully',
        user: mockUser,
      });
    });

    it('should return 404 if user not found', async () => {
      req.params = { id: 'non-existent-id' };

      prisma.user.findFirst.mockResolvedValue(null);

      await getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should handle errors and pass to next middleware', async () => {
      req.params = { id: 'user-id' };
      const error = new Error('Database error');
      prisma.user.findFirst.mockRejectedValue(error);

      await getUserById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateUserAccount', () => {
    it('should update user account successfully', async () => {
      req.params = { id: 'user-id' };
      req.body = {
        firstName: 'Updated',
        lastName: 'User',
        phoneNumber: '1234567890',
      };
      req.user = { id: 'user-id', role: 'MEMBER' };

      const { updateUserAccountValidation } = await import(
        '../../validations/user.validation.js'
      );
      updateUserAccountValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        ...req.body,
      });
      mockCreateActivityLog.mockResolvedValue();
      mockGenerateActivityDetails.mockReturnValue({});

      await updateUserAccount(req, res, next);

      expect(updateUserAccountValidation).toHaveBeenCalledWith(req.body);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-id', deletedAt: null },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: expect.objectContaining({
          firstName: 'Updated',
          lastName: 'User',
          phoneNumber: '1234567890',
        }),
        select: expect.any(Object),
      });
      expect(mockCreateActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User account updated successfully',
        user: expect.objectContaining({
          firstName: 'Updated',
          lastName: 'User',
          phoneNumber: '1234567890',
        }),
      });
    });

    it('should allow admin to update additional fields', async () => {
      req.params = { id: 'user-id' };
      req.body = {
        firstName: 'Updated',
        role: 'ADMIN',
        departmentId: 'dept-123',
        organizationId: 'org-456',
      };
      req.user = { id: 'admin-id', role: 'ADMIN' };

      const { updateUserAccountValidation } = await import(
        '../../validations/user.validation.js'
      );
      updateUserAccountValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        isActive: true,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        ...req.body,
      });
      mockCreateActivityLog.mockResolvedValue();
      mockGenerateActivityDetails.mockReturnValue({});

      await updateUserAccount(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: expect.objectContaining({
          firstName: 'Updated',
          role: 'ADMIN',
          departmentId: 'dept-123',
          organizationId: 'org-456',
          updatedBy: 'admin-id',
        }),
        select: expect.any(Object),
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error if user ID is missing', async () => {
      req.params = {}; // Missing ID
      req.body = { firstName: 'Updated' };

      await updateUserAccount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User ID is required',
      });
    });

    it('should return error if validation fails', async () => {
      req.params = { id: 'user-id' };
      req.body = { firstName: '' };

      const { updateUserAccountValidation } = await import(
        '../../validations/user.validation.js'
      );
      updateUserAccountValidation.mockReturnValue({
        error: { details: [{ message: 'First name is required' }] },
      });

      await updateUserAccount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'First name is required',
      });
    });

    it('should return error if user not found', async () => {
      req.params = { id: 'non-existent-id' };
      req.body = { firstName: 'Updated' };
      req.user = { id: 'user-id' };

      const { updateUserAccountValidation } = await import(
        '../../validations/user.validation.js'
      );
      updateUserAccountValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      prisma.user.findFirst.mockResolvedValue(null);

      await updateUserAccount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should return error if account is not active', async () => {
      req.params = { id: 'user-id' };
      req.body = { firstName: 'Updated' };
      req.user = { id: 'user-id' };

      const { updateUserAccountValidation } = await import(
        '../../validations/user.validation.js'
      );
      updateUserAccountValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        isActive: false,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      await updateUserAccount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Account is not active',
      });
    });
  });

  describe('updateUserPassword', () => {
    it('should update user password successfully', async () => {
      req.params = { id: 'user-id' };
      req.body = {
        oldPassword: 'oldpassword',
        newPassword: 'newpassword',
      };
      req.user = { id: 'user-id' };

      const { updatePasswordValidation } = await import(
        '../../validations/user.validation.js'
      );
      updatePasswordValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      const mockUser = {
        id: 'user-id',
        password: 'hashed-old-password',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockHashPassword.mockResolvedValue('hashed-new-password');
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        password: 'hashed-new-password',
      });
      mockCreateActivityLog.mockResolvedValue();

      await updateUserPassword(req, res, next);

      expect(updatePasswordValidation).toHaveBeenCalledWith(req.body);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id', deletedAt: null },
        select: { id: true, password: true },
      });
      expect(mockComparePassword).toHaveBeenCalledWith(
        'oldpassword',
        'hashed-old-password',
      );
      expect(mockHashPassword).toHaveBeenCalledWith('newpassword');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { password: 'hashed-new-password' },
      });
      expect(mockCreateActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password updated successfully',
      });
    });

    it('should return error if validation fails', async () => {
      req.params = { id: 'user-id' };
      req.body = { oldPassword: '', newPassword: '' };

      const { updatePasswordValidation } = await import(
        '../../validations/user.validation.js'
      );
      updatePasswordValidation.mockReturnValue({
        error: { details: [{ message: 'Old password is required' }] },
      });

      await updateUserPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Old password is required',
      });
    });

    it('should return error if user not found', async () => {
      req.params = { id: 'non-existent-id' };
      req.body = { oldPassword: 'oldpassword', newPassword: 'newpassword' };

      const { updatePasswordValidation } = await import(
        '../../validations/user.validation.js'
      );
      updatePasswordValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      prisma.user.findUnique.mockResolvedValue(null);

      await updateUserPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should return error if old password is incorrect', async () => {
      req.params = { id: 'user-id' };
      req.body = { oldPassword: 'wrongpassword', newPassword: 'newpassword' };

      const { updatePasswordValidation } = await import(
        '../../validations/user.validation.js'
      );
      updatePasswordValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      const mockUser = {
        id: 'user-id',
        password: 'hashed-old-password',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(false);

      await updateUserPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Incorrect old password',
      });
    });

    it('should return error if new password is same as old password', async () => {
      req.params = { id: 'user-id' };
      req.body = { oldPassword: 'samepassword', newPassword: 'samepassword' };

      const { updatePasswordValidation } = await import(
        '../../validations/user.validation.js'
      );
      updatePasswordValidation.mockReturnValue({
        error: null,
        value: req.body,
      });

      const mockUser = {
        id: 'user-id',
        password: 'hashed-password',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);

      await updateUserPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'New password must be different from the old one',
      });
    });
  });

  describe('softDeleteUser', () => {
    it('should soft delete user successfully', async () => {
      req.params = { id: 'user-id' };
      req.user = { id: 'admin-id' };

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        deletedAt: null,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
        isActive: false,
      });
      mockCreateActivityLog.mockResolvedValue();
      mockGenerateActivityDetails.mockReturnValue({});

      await softDeleteUser(req, res, next);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-id', deletedAt: null },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
      expect(mockCreateActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User deleted successfully',
      });
    });

    it('should return error if user not found', async () => {
      req.params = { id: 'non-existent-id' };
      req.user = { id: 'admin-id' };

      prisma.user.findFirst.mockResolvedValue(null);

      await softDeleteUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should return error if user already deleted', async () => {
      req.params = { id: 'user-id' };
      req.user = { id: 'admin-id' };

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        deletedAt: new Date(),
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      await softDeleteUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User already deleted',
      });
    });
  });

  describe('restoreUser', () => {
    it('should restore user successfully', async () => {
      req.params = { id: 'user-id' };
      req.user = { id: 'admin-id' };

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        deletedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        deletedAt: null,
        isActive: true,
      });
      mockCreateActivityLog.mockResolvedValue();

      await restoreUser(req, res, next);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          deletedAt: null,
          isActive: true,
        },
      });
      expect(mockCreateActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User restored successfully',
      });
    });

    it('should return error if user not found or not deleted', async () => {
      req.params = { id: 'user-id' };
      req.user = { id: 'admin-id' };

      // Case 1: User not found
      prisma.user.findUnique.mockResolvedValue(null);

      await restoreUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found or not deleted',
      });

      // Case 2: User found but not deleted
      jest.clearAllMocks();
      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        deletedAt: null,
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await restoreUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found or not deleted',
      });
    });
  });

  describe('uploadUserProfilePic', () => {
    it('should upload profile picture successfully', async () => {
      req.params = { id: 'user-id' };
      req.user = { id: 'user-id' };
      req.file = {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/jpeg',
      };

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        profilePic: null,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockUploadToCloudinary.mockResolvedValue(
        'https://cloudinary.com/profile.jpg',
      );
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        profilePic: 'https://cloudinary.com/profile.jpg',
      });
      mockCreateActivityLog.mockResolvedValue();

      await uploadUserProfilePic(req, res, next);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-id',
          deletedAt: null,
        },
      });
      expect(mockUploadToCloudinary).toHaveBeenCalledWith(
        req.file.buffer,
        'profile_pictures',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { profilePic: 'https://cloudinary.com/profile.jpg' },
      });
      expect(mockCreateActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Profile picture uploaded successfully',
        profilePicUrl: 'https://cloudinary.com/profile.jpg',
        user: expect.objectContaining({
          profilePic: 'https://cloudinary.com/profile.jpg',
        }),
      });
    });

    it('should return error if user ID is missing', async () => {
      req.params = {}; // Missing ID
      req.file = { buffer: Buffer.from('test-image') };

      await uploadUserProfilePic(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required',
      });
    });

    it('should return error if user not found', async () => {
      req.params = { id: 'non-existent-id' };
      req.file = { buffer: Buffer.from('test-image') };

      prisma.user.findFirst.mockResolvedValue(null);

      await uploadUserProfilePic(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });

    it('should return error if no file uploaded', async () => {
      req.params = { id: 'user-id' };
      req.file = undefined;

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      await uploadUserProfilePic(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No file uploaded',
      });
    });
  });

  describe('deleteUserProfilePic', () => {
    it('should delete profile picture successfully', async () => {
      req.params = { id: 'user-id' };
      req.user = { id: 'user-id' };

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        profilePic: 'https://cloudinary.com/profile.jpg',
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockDeleteFromCloudinary.mockResolvedValue({ result: 'ok' });
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        profilePic: null,
      });
      mockCreateActivityLog.mockResolvedValue();

      await deleteUserProfilePic(req, res, next);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-id',
          deletedAt: null,
        },
      });
      expect(mockDeleteFromCloudinary).toHaveBeenCalledWith(
        'https://cloudinary.com/profile.jpg',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { profilePic: null },
      });
      expect(mockCreateActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Profile picture deleted successfully',
        user: expect.objectContaining({
          profilePic: null,
        }),
      });
    });

    it('should return error if user ID is missing', async () => {
      req.params = {}; // Missing ID

      await deleteUserProfilePic(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required',
      });
    });

    it('should return error if user not found', async () => {
      req.params = { id: 'non-existent-id' };

      prisma.user.findFirst.mockResolvedValue(null);

      await deleteUserProfilePic(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Profile picture not found',
      });
    });

    it('should return error if user has no profile picture', async () => {
      req.params = { id: 'user-id' };

      const mockUser = {
        id: 'user-id',
        email: 'user@example.com',
        profilePic: null,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);

      await deleteUserProfilePic(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Profile picture not found',
      });
    });
  });
});
