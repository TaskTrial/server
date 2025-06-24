/* eslint-env node */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import prisma from '../../config/prismaClient.js';
import {
  signup,
  signin,
  verifyEmail,
  resendOTP,
  forgotPassword,
  resetPassword,
  logout,
  refreshAccessToken,
  googleOAuthLogin,
  firebaseLogin,
} from '../../controllers/auth.controller.js';
import {
  mockHashPassword,
  mockComparePassword,
  mockGenerateOTP,
  mockHashOTP,
  mockValidateOTP,
  mockSendEmail,
  mockGenerateAccessToken,
  mockGenerateRefreshToken,
  mockCreateActivityLog,
  mockGenerateActivityDetails,
  mockGoogleVerifyIdToken,
} from '../setup.js';

/* eslint no-undef: off */

// Mock validation schemas
jest.mock('../../validations/auth.validations.js', () => ({
  signupValidation: jest.fn(),
  signinValidation: jest.fn(),
  verifyEmailValidation: jest.fn(),
  forgotPasswordValidation: jest.fn(),
  resetPasswordValidation: jest.fn(),
}));

// Mock jwt
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  decode: jest.fn(),
  sign: jest.fn().mockReturnValue('new-access-token'),
}));

// Mock firebase
jest.mock('../../config/firebase.js', () => ({
  __esModule: true,
  default: {
    auth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn(),
    }),
  },
}));

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
      };

      req.body = userData;

      // Mock validation
      const { signupValidation } = await import(
        '../../validations/auth.validations.js'
      );
      signupValidation.mockReturnValue({ error: null });

      // Mock Prisma calls
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-id',
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'MEMBER',
        isActive: false,
        createdAt: new Date(),
      });

      // Mock utility functions
      mockHashPassword.mockResolvedValue('hashed-password');
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashed-otp');
      mockSendEmail.mockResolvedValue();
      mockCreateActivityLog.mockResolvedValue();
      mockGenerateActivityDetails.mockReturnValue({});

      await signup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User created. Please verify your email.',
        userId: 'user-id',
        user: expect.objectContaining({
          email: userData.email,
          username: userData.username,
        }),
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: userData.email,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          password: 'hashed-password',
          role: 'MEMBER',
          isActive: false,
        }),
      });
    });

    it('should return error if validation fails', async () => {
      req.body = { email: 'invalid-email' };

      const { signupValidation } = await import(
        '../../validations/auth.validations.js'
      );
      signupValidation.mockReturnValue({
        error: { details: [{ message: 'Invalid email format' }] },
      });

      await signup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email format',
      });
    });

    it('should return error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
      };

      req.body = userData;

      const { signupValidation } = await import(
        '../../validations/auth.validations.js'
      );
      signupValidation.mockReturnValue({ error: null });

      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-user-id',
        email: userData.email,
      });

      await signup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User with this email or username already exists',
      });
    });
  });

  describe('signin', () => {
    it('should sign in user successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      req.body = loginData;

      const { signinValidation } = await import(
        '../../validations/auth.validations.js'
      );
      signinValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: loginData.email,
        password: 'hashed-password',
        isActive: true,
        role: 'MEMBER',
        firstName: 'John',
        lastName: 'Doe',
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateAccessToken.mockReturnValue('access-token');
      mockGenerateRefreshToken.mockReturnValue('refresh-token');
      prisma.user.update.mockResolvedValue(mockUser);
      mockCreateActivityLog.mockResolvedValue();

      await signin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User login successfully',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: expect.objectContaining({
            id: 'user-id',
            email: loginData.email,
          }),
        }),
      );
    });

    it('should return error if user not found', async () => {
      req.body = { email: 'nonexistent@example.com', password: 'password123' };

      const { signinValidation } = await import(
        '../../validations/auth.validations.js'
      );
      signinValidation.mockReturnValue({ error: null });

      prisma.user.findFirst.mockResolvedValue(null);

      await signin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email or password',
      });
    });

    it('should return error if password is incorrect', async () => {
      req.body = { email: 'test@example.com', password: 'wrongpassword' };

      const { signinValidation } = await import(
        '../../validations/auth.validations.js'
      );
      signinValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: true,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(false);

      await signin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email or password',
      });
    });

    it('should return error if account is not active', async () => {
      req.body = { email: 'inactive@example.com', password: 'password123' };

      const { signinValidation } = await import(
        '../../validations/auth.validations.js'
      );
      signinValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: 'inactive@example.com',
        password: 'hashed-password',
        isActive: false,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);

      await signin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Account not activated. Please verify your email',
      });
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully with valid OTP', async () => {
      req.body = {
        email: 'test@example.com',
        otp: '123456',
      };

      const { verifyEmailValidation } = await import(
        '../../validations/auth.validations.js'
      );
      verifyEmailValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        emailVerificationToken: 'hashed-otp',
        emailVerificationExpires: new Date(Date.now() + 600000), // 10 minutes from now
        isActive: false,
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockValidateOTP.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });
      mockCreateActivityLog.mockResolvedValue();

      await verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email verified successfully',
      });
    });

    it('should return error if user not found', async () => {
      req.body = { email: 'nonexistent@example.com', otp: '123456' };

      const { verifyEmailValidation } = await import(
        '../../validations/auth.validations.js'
      );
      verifyEmailValidation.mockReturnValue({ error: null });

      prisma.user.findFirst.mockResolvedValue(null);

      await verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should return error if OTP is invalid', async () => {
      req.body = { email: 'test@example.com', otp: 'invalid-otp' };

      const { verifyEmailValidation } = await import(
        '../../validations/auth.validations.js'
      );
      verifyEmailValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        emailVerificationToken: 'hashed-otp',
        emailVerificationExpires: new Date(Date.now() + 600000),
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockValidateOTP.mockResolvedValue(false);

      await verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or expired OTP',
      });
    });
  });

  describe('resendOTP', () => {
    it('should resend OTP successfully', async () => {
      req.body = { email: 'test@example.com' };

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashed-otp');
      mockSendEmail.mockResolvedValue();
      prisma.user.update.mockResolvedValue(mockUser);
      mockCreateActivityLog.mockResolvedValue();

      await resendOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Code send successfully. Please check your email',
      });
    });

    it('should return error if email is missing', async () => {
      req.body = {};

      await resendOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Please enter a valid email',
      });
    });

    it('should return error if user not found', async () => {
      req.body = { email: 'nonexistent@example.com' };

      prisma.user.findUnique.mockResolvedValue(null);

      await resendOTP(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email successfully', async () => {
      req.body = { email: 'test@example.com' };

      const { forgotPasswordValidation } = await import(
        '../../validations/auth.validations.js'
      );
      forgotPasswordValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashed-otp');
      mockSendEmail.mockResolvedValue();
      prisma.user.update.mockResolvedValue(mockUser);
      mockCreateActivityLog.mockResolvedValue();

      await forgotPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password reset OTP sent',
      });
    });

    it('should return generic message if user not found', async () => {
      req.body = { email: 'nonexistent@example.com' };

      const { forgotPasswordValidation } = await import(
        '../../validations/auth.validations.js'
      );
      forgotPasswordValidation.mockReturnValue({ error: null });

      prisma.user.findFirst.mockResolvedValue(null);

      await forgotPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If an account exists, a reset link has been sent',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      req.body = {
        email: 'test@example.com',
        otp: '123456',
        newPassword: 'newpassword123',
      };

      const { resetPasswordValidation } = await import(
        '../../validations/auth.validations.js'
      );
      resetPasswordValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        passwordResetToken: 'hashed-otp',
        passwordResetExpires: new Date(Date.now() + 600000),
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockValidateOTP.mockResolvedValue(true);
      mockHashPassword.mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue(mockUser);
      mockCreateActivityLog.mockResolvedValue();

      await resetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password reset successfully',
      });
    });

    it('should return error if user not found', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        otp: '123456',
        newPassword: 'newpassword123',
      };

      const { resetPasswordValidation } = await import(
        '../../validations/auth.validations.js'
      );
      resetPasswordValidation.mockReturnValue({ error: null });

      prisma.user.findFirst.mockResolvedValue(null);

      await resetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should return error if OTP is invalid', async () => {
      req.body = {
        email: 'test@example.com',
        otp: 'invalid-otp',
        newPassword: 'newpassword123',
      };

      const { resetPasswordValidation } = await import(
        '../../validations/auth.validations.js'
      );
      resetPasswordValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        passwordResetToken: 'hashed-otp',
        passwordResetExpires: new Date(Date.now() + 600000),
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockValidateOTP.mockResolvedValue(false);

      await resetPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid or expired reset token',
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      req.body = { refreshToken: 'valid-refresh-token' };

      const jwt = await import('jsonwebtoken');

      // Mock the verify function to call the callback directly
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { id: 'user-id', role: 'MEMBER' });
        return { id: 'user-id', role: 'MEMBER' };
      });

      const mockUser = {
        id: 'user-id',
        refreshToken: 'valid-refresh-token',
        role: 'MEMBER',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockCreateActivityLog.mockResolvedValue();

      await refreshAccessToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalled();
      expect(mockCreateActivityLog).toHaveBeenCalled();
    });

    it('should return error if refresh token is missing', async () => {
      req.body = {};

      await refreshAccessToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Refresh token missing',
      });
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      req.cookies = { refreshToken: 'valid-refresh-token' };

      const jwt = await import('jsonwebtoken');
      jwt.decode.mockReturnValue({ id: 'user-id' });

      prisma.user.update.mockResolvedValue({ id: 'user-id' });
      mockCreateActivityLog.mockResolvedValue();

      await logout(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.any(Object),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should handle missing refresh token gracefully', async () => {
      req.cookies = {};

      await logout(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(204);
    });
  });

  describe('googleOAuthLogin', () => {
    it('should authenticate existing user with Google', async () => {
      req.body = { idToken: 'google-id-token' };

      mockGoogleVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'google@example.com',
          given_name: 'Google',
          family_name: 'User',
          sub: 'google-sub-id',
          picture: 'profile-pic-url',
        }),
      });

      const mockUser = {
        id: 'user-id',
        email: 'google@example.com',
        firstName: 'Google',
        lastName: 'User',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      mockGenerateAccessToken.mockReturnValue('access-token');
      mockGenerateRefreshToken.mockReturnValue('refresh-token');
      mockCreateActivityLog.mockResolvedValue();

      await googleOAuthLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Google authentication successful',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        }),
      );
    });

    it('should create new user with Google data if not exists', async () => {
      req.body = { idToken: 'google-id-token' };

      mockGoogleVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'newgoogle@example.com',
          given_name: 'New',
          family_name: 'User',
          sub: 'google-sub-id',
          picture: 'profile-pic-url',
        }),
      });

      const newUser = {
        id: 'new-user-id',
        email: 'newgoogle@example.com',
        firstName: 'New',
        lastName: 'User',
        username: 'newgoogle',
        profilePic: 'profile-pic-url',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);
      prisma.user.update.mockResolvedValue(newUser);
      mockGenerateAccessToken.mockReturnValue('access-token');
      mockGenerateRefreshToken.mockReturnValue('refresh-token');
      mockCreateActivityLog.mockResolvedValue();

      await googleOAuthLogin(req, res);

      expect(prisma.user.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Google authentication successful',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        }),
      );
    });
  });

  describe('firebaseLogin', () => {
    it('should authenticate existing user with Firebase', async () => {
      req.body = { idToken: 'firebase-id-token' };

      // Mock Firebase verifyIdToken
      const firebaseAdmin = await import('../../config/firebase.js');
      const mockVerifyIdToken = jest.fn().mockResolvedValue({
        uid: 'firebase-uid',
        email: 'firebase@example.com',
        name: 'Firebase User',
        picture: 'profile-pic-url',
      });

      // Set up the mock chain
      firebaseAdmin.default.auth.mockReturnValue({
        verifyIdToken: mockVerifyIdToken,
      });

      const mockUser = {
        id: 'user-id',
        email: 'firebase@example.com',
        firebaseUid: 'firebase-uid',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      mockGenerateAccessToken.mockReturnValue('access-token');
      mockGenerateRefreshToken.mockReturnValue('refresh-token');
      mockCreateActivityLog.mockResolvedValue();

      await firebaseLogin(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith('firebase-id-token');
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(mockGenerateAccessToken).toHaveBeenCalled();
      expect(mockGenerateRefreshToken).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
      expect(mockCreateActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Firebase authentication successful',
        }),
      );
    });

    it('should create new user with Firebase data if not exists', async () => {
      req.body = { idToken: 'firebase-id-token' };

      // Mock Firebase verifyIdToken
      const firebaseAdmin = await import('../../config/firebase.js');
      const mockVerifyIdToken = jest.fn().mockResolvedValue({
        uid: 'new-firebase-uid',
        email: 'newfirebase@example.com',
        name: 'New Firebase User',
        picture: 'profile-pic-url',
      });

      // Set up the mock chain
      firebaseAdmin.default.auth.mockReturnValue({
        verifyIdToken: mockVerifyIdToken,
      });

      const newUser = {
        id: 'new-user-id',
        email: 'newfirebase@example.com',
        firebaseUid: 'new-firebase-uid',
        firstName: 'New',
        lastName: 'Firebase User',
        isActive: true,
      };

      // First call for firebaseUid lookup
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // Second call for email lookup
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // For username uniqueness check
      prisma.user.findUnique.mockResolvedValueOnce(null);

      prisma.user.create.mockResolvedValue(newUser);
      prisma.user.update.mockResolvedValue(newUser);
      mockGenerateAccessToken.mockReturnValue('access-token');
      mockGenerateRefreshToken.mockReturnValue('refresh-token');
      mockCreateActivityLog.mockResolvedValue();

      await firebaseLogin(req, res, next);

      expect(mockVerifyIdToken).toHaveBeenCalledWith('firebase-id-token');
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalled();
      expect(mockGenerateAccessToken).toHaveBeenCalled();
      expect(mockGenerateRefreshToken).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
      expect(mockCreateActivityLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Firebase authentication successful',
        }),
      );
    });
  });
});
