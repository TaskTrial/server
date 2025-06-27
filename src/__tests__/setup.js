/* eslint-disable */
/* eslint-env node */
/* global process, global, afterEach */

// Determine test type: unit or integration
const isUnitTest = process.env.UNIT_TEST === '1';
const isIntegration = !isUnitTest;

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.STAGE = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

// Set up mock implementations with default values
const mockComparePassword = jest.fn().mockImplementation(() => true);
const mockGenerateOTP = jest.fn().mockImplementation(() => '123456');
const mockHashOTP = jest.fn().mockImplementation(() => 'hashed-otp');
const mockValidateOTP = jest.fn().mockImplementation(() => true);
const mockSendEmail = jest.fn().mockResolvedValue(true);
const mockGenerateAccessToken = jest
  .fn()
  .mockImplementation(() => 'test-access-token');
const mockGenerateRefreshToken = jest
  .fn()
  .mockImplementation(() => 'test-refresh-token');
const mockGenerateActivityDetails = jest.fn();
const mockGoogleVerifyIdToken = jest.fn().mockResolvedValue({
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/photo.jpg',
});
const mockUploadToCloudinary = jest.fn().mockResolvedValue({
  secure_url: 'https://example.com/image.jpg',
  public_id: 'test-public-id',
});
const mockDeleteFromCloudinary = jest.fn().mockResolvedValue(true);
const mockHashPassword = jest
  .fn()
  .mockImplementation((pass) => `hashed-${pass}`);

// Create mock function factory to support chaining
const createMockFn = () => {
  return jest.fn().mockImplementation(() => Promise.resolve());
};

// Only mock Prisma for unit tests
let mockPrisma;
let mockCreateActivityLog;

if (isUnitTest) {
  // Create model mock factory with support for chainable mock methods
  const createModelMock = () => {
    const modelMock = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      upsert: jest.fn(),
    };

    // Make all mock functions chainable for mockResolvedValue etc.
    Object.keys(modelMock).forEach((key) => {
      if (typeof modelMock[key] === 'function') {
        modelMock[key].mockResolvedValue = (value) => {
          modelMock[key].mockImplementation(() => Promise.resolve(value));
          return modelMock[key];
        };

        modelMock[key].mockResolvedValueOnce = (value) => {
          modelMock[key].mockImplementationOnce(() => Promise.resolve(value));
          return modelMock[key];
        };

        modelMock[key].mockRejectedValue = (error) => {
          modelMock[key].mockImplementation(() => Promise.reject(error));
          return modelMock[key];
        };

        modelMock[key].mockRejectedValueOnce = (error) => {
          modelMock[key].mockImplementationOnce(() => Promise.reject(error));
          return modelMock[key];
        };

        modelMock[key].mockReturnValue = (value) => {
          modelMock[key].mockImplementation(() => value);
          return modelMock[key];
        };

        modelMock[key].mockReturnValueOnce = (value) => {
          modelMock[key].mockImplementationOnce(() => value);
          return modelMock[key];
        };
      }
    });

    return modelMock;
  };

  mockPrisma = {
    user: createModelMock(),
    organization: createModelMock(),
    department: createModelMock(),
    departmentMember: createModelMock(),
    team: createModelMock(),
    teamMember: createModelMock(),
    project: createModelMock(),
    projectMember: createModelMock(),
    task: createModelMock(),
    sprint: createModelMock(),
    chatRoom: createModelMock(),
    chatMessage: createModelMock(),
    videoConferenceSession: createModelMock(),
    activityLog: createModelMock(),
    permission: createModelMock(),
    comment: createModelMock(),
    organizationOwner: createModelMock(),
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  // Also make $transaction chainable
  mockPrisma.$transaction.mockResolvedValue = (value) => {
    mockPrisma.$transaction.mockImplementation(() => Promise.resolve(value));
    return mockPrisma.$transaction;
  };

  mockPrisma.$transaction.mockResolvedValueOnce = (value) => {
    mockPrisma.$transaction.mockImplementationOnce(() =>
      Promise.resolve(value),
    );
    return mockPrisma.$transaction;
  };

  mockCreateActivityLog = jest.fn();

  // Make mockCreateActivityLog chainable too
  mockCreateActivityLog.mockResolvedValue = (value) => {
    mockCreateActivityLog.mockImplementation(() => Promise.resolve(value));
    return mockCreateActivityLog;
  };

  mockCreateActivityLog.mockResolvedValueOnce = (value) => {
    mockCreateActivityLog.mockImplementationOnce(() => Promise.resolve(value));
    return mockCreateActivityLog;
  };
}

// Mock common utility functions for both unit and integration tests
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

// Different mocks for unit vs integration tests
if (isUnitTest) {
  jest.mock('../utils/activityLogs.utils.js', () => ({
    createActivityLog: mockCreateActivityLog,
    generateActivityDetails: mockGenerateActivityDetails,
  }));

  // Mock PrismaClient only for unit tests
  jest.mock('@prisma/client', () => {
    return {
      PrismaClient: jest.fn(() => mockPrisma),
    };
  });

  // Mock prismaClient module to return our mockPrisma
  jest.mock('../config/prismaClient.js', () => ({
    __esModule: true,
    default: mockPrisma,
  }));
} else {
  // For integration tests, we use a real implementation but still mock some functions
  jest.mock('../utils/activityLogs.utils.js', () => ({
    createActivityLog: jest.fn().mockResolvedValue({}),
    generateActivityDetails: mockGenerateActivityDetails,
  }));
}

jest.mock('../utils/googleVerifyToken.utils.js', () => ({
  googleVerifyIdToken: mockGoogleVerifyIdToken,
}));

jest.mock('../utils/cloudinary.utils.js', () => ({
  uploadToCloudinary: mockUploadToCloudinary,
  deleteFromCloudinary: mockDeleteFromCloudinary,
}));

// Mock Firebase for both test types
jest.mock('../config/firebase.js', () => ({
  __esModule: true,
  default: {
    auth: jest.fn(() => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        uid: 'test-uid',
      }),
    })),
  },
}));

// Set up global test utilities for both test types
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

// Clean up mocks after each test
afterEach(() => {
  jest.clearAllMocks();

  // Additional cleanup for unit tests
  if (isUnitTest && mockPrisma) {
    Object.values(mockPrisma).forEach((model) => {
      if (typeof model === 'object' && model !== null) {
        Object.values(model).forEach((fn) => {
          if (typeof fn === 'function' && fn.mockClear) fn.mockClear();
        });
      }
    });
    if (mockCreateActivityLog && mockCreateActivityLog.mockClear) {
      mockCreateActivityLog.mockClear();
    }
  }
});

// Export mocks for use in tests
export {
  mockComparePassword,
  mockGenerateOTP,
  mockHashOTP,
  mockValidateOTP,
  mockSendEmail,
  mockGenerateAccessToken,
  mockGenerateRefreshToken,
  mockGenerateActivityDetails,
  mockGoogleVerifyIdToken,
  mockUploadToCloudinary,
  mockDeleteFromCloudinary,
  mockHashPassword,
  mockPrisma,
  mockCreateActivityLog,
  isUnitTest,
  isIntegration,
};
