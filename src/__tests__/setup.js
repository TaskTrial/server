/* eslint-env node */
/* global process, global, afterEach */
import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Create mock Prisma client
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  organization: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  department: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  departmentMember: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  team: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  teamMember: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  projectMember: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  task: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  sprint: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  chatRoom: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  chatMessage: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  videoConferenceSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  activityLog: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  permission: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  comment: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  organizationOwner: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

// Mock Prisma client
jest.mock('../config/prismaClient.js', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock utility functions
const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();
const mockGenerateOTP = jest.fn();
const mockHashOTP = jest.fn();
const mockValidateOTP = jest.fn();
const mockSendEmail = jest.fn();
const mockGenerateAccessToken = jest.fn();
const mockGenerateRefreshToken = jest.fn();
const mockCreateActivityLog = jest.fn();
const mockGenerateActivityDetails = jest.fn();
const mockGoogleVerifyIdToken = jest.fn();
const mockUploadToCloudinary = jest.fn();
const mockDeleteFromCloudinary = jest.fn();

jest.mock('../utils/password.utils.js', () => ({
  hashPassword: mockHashPassword,
  comparePassword: mockComparePassword,
}));

jest.mock('../utils/otp.utils.js', () => ({
  generateOTP: mockGenerateOTP,
  hashOTP: mockHashOTP,
  validateOTP: mockValidateOTP,
}));

jest.mock('../utils/email.utils.js', () => ({
  sendEmail: mockSendEmail,
}));

jest.mock('../utils/token.utils.js', () => ({
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
}));

jest.mock('../utils/activityLogs.utils.js', () => ({
  createActivityLog: mockCreateActivityLog,
  generateActivityDetails: mockGenerateActivityDetails,
}));

jest.mock('../utils/googleVerifyToken.utils.js', () => ({
  googleVerifyIdToken: mockGoogleVerifyIdToken,
}));

jest.mock('../utils/cloudinary.utils.js', () => ({
  uploadToCloudinary: mockUploadToCloudinary,
  deleteFromCloudinary: mockDeleteFromCloudinary,
}));

jest.mock('../config/firebase.js', () => ({
  __esModule: true,
  default: {
    auth: jest.fn(() => ({
      verifyIdToken: jest.fn(),
    })),
  },
}));

// Export all mocks so they can be accessed in tests
export {
  mockPrisma,
  mockHashPassword,
  mockComparePassword,
  mockGenerateOTP,
  mockHashOTP,
  mockValidateOTP,
  mockSendEmail,
  mockGenerateAccessToken,
  mockGenerateRefreshToken,
  mockGoogleVerifyIdToken,
  mockCreateActivityLog,
  mockGenerateActivityDetails,
  mockUploadToCloudinary,
  mockDeleteFromCloudinary,
};

// Global test utilities
global.mockRequest = () => {
  const req = {};
  req.body = {};
  req.params = {};
  req.query = {};
  req.cookies = {};
  req.headers = {};
  req.ip = '127.0.0.1';
  req.user = null;
  return req;
};

global.mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
};

global.mockNext = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
