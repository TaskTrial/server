// E2E test environment setup
import { jest } from '@jest/globals';

/* eslint no-undef: off */

// Set longer timeout for E2E tests (more than integration tests since they test full workflows)
jest.setTimeout(60000);

// Mock email service to prevent actually sending emails during tests
jest.mock('../utils/email.utils.js', () => ({
  sendEmail: () => Promise.resolve({ success: true }),
}));

// Mock activity log creation to speed up tests
jest.mock('../utils/activityLogs.utils.js', () => ({
  createActivityLog: () => Promise.resolve({}),
  generateActivityDetails: () => ({}),
}));

// Mock firebase admin to avoid ES module issues
jest.mock('../config/firebase.js', () => {
  return {
    __esModule: true,
    default: {
      auth: () => ({
        verifyIdToken: jest.fn().mockResolvedValue({
          uid: 'test-firebase-uid',
          email: 'firebase-test@example.com',
          name: 'Firebase Test User',
          picture: 'https://example.com/profile.jpg',
        }),
      }),
    },
  };
});

// Mock the server's index.js file
jest.mock('../index.js', () => {
  return {
    __esModule: true,
    app: require('./mocks/index.mock.js').app,
    server: require('./mocks/index.mock.js').server,
  };
});
