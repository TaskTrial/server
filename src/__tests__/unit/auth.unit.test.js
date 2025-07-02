/* eslint-env node */
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  mockHashPassword,
  mockComparePassword,
  mockGenerateOTP,
  mockHashOTP,
  mockValidateOTP,
  mockSendEmail,
  mockGenerateAccessToken,
  mockGenerateRefreshToken,
} from '../setup.js';

// Mock implementations for functions not exported from setup.js
jest.mock('../../utils/activityLogs.utils.js', () => ({
  createActivityLog: jest.fn().mockResolvedValue({}),
  generateActivityDetails: jest.fn().mockReturnValue({}),
}));

// Mock Prisma client
jest.mock('../../config/prismaClient.js', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

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

// Mock axios for Google OAuth
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

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
  googleOAuthCodeExchange,
} from '../../controllers/auth.controller.js';

const validations = jest.requireMock('../../validations/auth.validations.js');
const jwt = jest.requireMock('jsonwebtoken');
const axios = jest.requireMock('axios');

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      cookies: {},
      headers: {},
      ip: '127.0.0.1',
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      sendStatus: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
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
      validations.signupValidation.mockReturnValue({ error: null });

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
    });

    it('should return error if validation fails', async () => {
      req.body = { email: 'invalid-email' };

      validations.signupValidation.mockReturnValue({
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

      validations.signupValidation.mockReturnValue({ error: null });

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

      validations.signinValidation.mockReturnValue({ error: null });

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

      validations.signinValidation.mockReturnValue({ error: null });

      prisma.user.findFirst.mockResolvedValue(null);

      await signin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email or password',
      });
    });

    it('should return error if password is incorrect', async () => {
      req.body = { email: 'test@example.com', password: 'wrongpassword' };

      validations.signinValidation.mockReturnValue({ error: null });

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

      validations.signinValidation.mockReturnValue({ error: null });

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

      validations.verifyEmailValidation.mockReturnValue({ error: null });

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

      await verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email verified successfully',
      });
    });

    it('should return error if user not found', async () => {
      req.body = { email: 'nonexistent@example.com', otp: '123456' };

      validations.verifyEmailValidation.mockReturnValue({ error: null });

      prisma.user.findFirst.mockResolvedValue(null);

      await verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    it('should return error if OTP is invalid', async () => {
      req.body = { email: 'test@example.com', otp: 'invalid-otp' };

      validations.verifyEmailValidation.mockReturnValue({ error: null });

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

      validations.forgotPasswordValidation.mockReturnValue({ error: null });

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
      };

      prisma.user.findFirst.mockResolvedValue(mockUser);
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashed-otp');
      mockSendEmail.mockResolvedValue();
      prisma.user.update.mockResolvedValue(mockUser);

      await forgotPassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password reset OTP sent',
      });
    });

    it('should return generic message if user not found', async () => {
      req.body = { email: 'nonexistent@example.com' };

      validations.forgotPasswordValidation.mockReturnValue({ error: null });

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

      validations.resetPasswordValidation.mockReturnValue({ error: null });

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

      validations.resetPasswordValidation.mockReturnValue({ error: null });

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

      validations.resetPasswordValidation.mockReturnValue({ error: null });

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

      await refreshAccessToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalled();
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

      jwt.decode.mockReturnValue({ id: 'user-id' });

      prisma.user.update.mockResolvedValue({ id: 'user-id' });

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
      req.body = { access_token: 'google-access-token' };

      // Mock axios get call to Google's userinfo endpoint
      axios.get.mockResolvedValue({
        data: {
          sub: 'google-sub-id',
          email: 'google@example.com',
          name: 'Google User',
          given_name: 'Google',
          family_name: 'User',
          picture: 'profile-pic-url',
        },
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

      await googleOAuthLogin(req, res);

      expect(axios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer google-access-token`,
          },
        },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Google authentication successful',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        }),
      );
    });

    it('should return error if access_token is missing', async () => {
      req.body = {};

      await googleOAuthLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Access token is required',
      });
    });
  });

  describe('googleOAuthCodeExchange', () => {
    it('should exchange authorization code for tokens', async () => {
      req.body = { code: 'google-auth-code' };

      // Mock axios post call to Google's token endpoint
      axios.post.mockResolvedValue({
        data: {
          access_token: 'google-access-token',
          refresh_token: 'google-refresh-token',
          id_token: 'google-id-token',
        },
      });

      // Mock axios get call to Google's userinfo endpoint
      axios.get.mockResolvedValue({
        data: {
          sub: 'google-sub-id',
          email: 'google@example.com',
          name: 'Google User',
          given_name: 'Google',
          family_name: 'User',
          picture: 'profile-pic-url',
        },
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

      await googleOAuthCodeExchange(req, res, next);

      expect(axios.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          code: 'google-auth-code',
          grant_type: 'authorization_code',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Google authentication successful',
        }),
      );
    });

    it('should return error if code is missing', async () => {
      req.body = {};

      await googleOAuthCodeExchange(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authorization code is required',
      });
    });
  });
});
