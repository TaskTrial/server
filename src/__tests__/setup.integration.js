// Integration test environment setup
import { jest } from '@jest/globals';

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Mock email service to prevent actually sending emails
jest.mock('../utils/email.utils.js', () => ({
  sendEmail: () => Promise.resolve({ success: true }),
}));

// Mock activity log creation to speed up tests
jest.mock('../utils/activityLogs.utils.js', () => ({
  createActivityLog: () => Promise.resolve({}),
  generateActivityDetails: () => ({}),
}));
