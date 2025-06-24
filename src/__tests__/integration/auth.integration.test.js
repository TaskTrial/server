import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import request from 'supertest';
import { app } from '../../index.js'; // Adjust the path to your app's entry point
import prisma from '../../config/prismaClient.js';
import { hashPassword } from '../../utils/password.utils.js';

describe('Auth Endpoints', () => {
  let server;

  beforeAll((done) => {
    server = app.listen(4001, done); // Use a different port for testing
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    // Clean the database before each test
    await prisma.user.deleteMany({});
  });

  describe('POST /api/auth/signup', () => {
    it('should register a new user and return 201', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
      };

      const res = await request(server).post('/api/auth/signup').send(userData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty(
        'message',
        'User created. Please verify your email.',
      );
      expect(res.body).toHaveProperty('userId');

      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser.firstName).toBe(userData.firstName);
    });

    it('should not register a user with an existing email and return 400', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
      };

      // Create user first
      await prisma.user.create({
        data: {
          ...userData,
          role: 'MEMBER',
          password: await hashPassword(userData.password),
        },
      });

      const res = await request(server).post('/api/auth/signup').send(userData);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty(
        'message',
        'User with this email or username already exists',
      );
    });
  });

  describe('POST /api/auth/signin', () => {
    it('should log in an active user and return tokens', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
      };
      // Create and activate user
      await prisma.user.create({
        data: {
          ...userData,
          role: 'MEMBER',
          password: await hashPassword(userData.password),
          isActive: true,
        },
      });

      const res = await request(server)
        .post('/api/auth/signin')
        .send({ email: userData.email, password: userData.password });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'User login successfully');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should not log in with invalid credentials and return 401', async () => {
      const res = await request(server)
        .post('/api/auth/signin')
        .send({ email: 'wrong@example.com', password: 'wrongpassword' });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Invalid email or password');
    });

    it('should not log in an inactive user and return 403', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
      };
      // Create inactive user
      await prisma.user.create({
        data: {
          ...userData,
          role: 'MEMBER',
          password: await hashPassword(userData.password),
          isActive: false,
        },
      });

      const res = await request(server)
        .post('/api/auth/signin')
        .send({ email: userData.email, password: userData.password });

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty(
        'message',
        'Account not activated. Please verify your email',
      );
    });
  });

  describe('POST /api/auth/verifyEmail', () => {
    it('should verify email with correct OTP and return 200', async () => {
      const otp = '123456';
      const hashedOtp = await hashPassword(otp); // Using hashPassword as a stand-in for hashOTP for simplicity
      const userData = {
        email: 'verify@example.com',
        password: 'Password123!',
        firstName: 'Verify',
        lastName: 'User',
        username: 'verifyuser',
        isActive: false,
        emailVerificationToken: hashedOtp,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      };

      await prisma.user.create({
        data: {
          ...userData,
          role: 'MEMBER',
          password: await hashPassword(userData.password),
        },
      });

      const res = await request(server)
        .post('/api/auth/verifyEmail')
        .send({ email: userData.email, otp });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Email verified successfully');

      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(dbUser.isActive).toBe(true);
    });
  });

  describe('POST /api/auth/forgotPassword', () => {
    it('should send a password reset OTP and return 200', async () => {
      const userData = {
        email: 'forgot@example.com',
        password: 'Password123!',
        firstName: 'Forgot',
        lastName: 'User',
        username: 'forgotuser',
        isActive: true,
      };
      await prisma.user.create({
        data: {
          ...userData,
          role: 'MEMBER',
          password: await hashPassword(userData.password),
        },
      });

      const res = await request(server)
        .post('/api/auth/forgotPassword')
        .send({ email: userData.email });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Password reset OTP sent');
    });
  });

  describe('POST /api/auth/resetPassword', () => {
    it('should reset password with correct OTP and return 200', async () => {
      const otp = '123456';
      const hashedOtp = await hashPassword(otp); // Using hashPassword as a stand-in for hashOTP
      const newPassword = 'NewPassword123!';
      const userData = {
        email: 'reset@example.com',
        password: 'Password123!',
        firstName: 'Reset',
        lastName: 'User',
        username: 'resetuser',
        isActive: true,
        passwordResetToken: hashedOtp,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      };
      const user = await prisma.user.create({
        data: {
          ...userData,
          role: 'MEMBER',
          password: await hashPassword(userData.password),
        },
      });

      const res = await request(server)
        .post('/api/auth/resetPassword')
        .send({ email: user.email, otp, newPassword });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Password reset successfully');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear the refresh token and return 200', async () => {
      // First, sign in to get a refresh token cookie
      const userData = {
        email: 'logout@example.com',
        password: 'Password123!',
      };
      const user = await prisma.user.create({
        data: {
          ...userData,
          role: 'MEMBER',
          username: 'logoutuser',
          firstName: 'Logout',
          lastName: 'User',
          password: await hashPassword(userData.password),
          isActive: true,
          refreshToken: 'somefaketoken',
        },
      });

      const loginRes = await request(server)
        .post('/api/auth/signin')
        .send(userData);

      const refreshTokenCookie = loginRes.headers['set-cookie'][0];

      const res = await request(server)
        .post('/api/auth/logout')
        .set('Cookie', refreshTokenCookie);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser.refreshToken).toBeNull();
    });
  });

  describe('POST /api/auth/refreshAccessToken', () => {
    it('should return a new access token if the refresh token is valid', async () => {
      const userData = {
        email: 'refresh@example.com',
        password: 'Password123!',
      };
      await prisma.user.create({
        data: {
          ...userData,
          role: 'MEMBER',
          username: 'refreshuser',
          firstName: 'Refresh',
          lastName: 'User',
          password: await hashPassword(userData.password),
          isActive: true,
        },
      });

      const loginRes = await request(server)
        .post('/api/auth/signin')
        .send(userData);

      const { refreshToken } = loginRes.body;

      const res = await request(server)
        .post('/api/auth/refreshAccessToken')
        .send({ refreshToken });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('accessToken');
    });
  });
});
