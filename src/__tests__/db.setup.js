// Database setup for integration tests
import { beforeAll, afterAll } from '@jest/globals';
import prisma from '../config/prismaClient.js';
import { server } from '../index.js';

/* eslint no-console: off */
/* eslint no-undef: off */

// Generate a unique test identifier for this test run
export const TEST_IDENTIFIER = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
console.log(`Using test identifier: ${TEST_IDENTIFIER}`);

// Setup before all tests
beforeAll(async () => {
  console.log('Setting up integration test environment...');

  // Store server reference in global so it can be accessed in afterAll hook
  global.__SERVER__ = server;
});

// Close database connection after all tests
afterAll(async () => {
  console.log('Closing database connection...');
  await prisma.$disconnect();

  // Close server if it's running
  if (global.__SERVER__) {
    await new Promise((resolve) => {
      global.__SERVER__.close(() => {
        console.log('Server closed');
        resolve();
      });
    });
  }
});

/**
 * Helper function to create test-specific data
 * Instead of deleting data, we use a unique identifier for test data
 * This allows tests to run in isolation without deleting existing data
 */
export function createTestData(data) {
  if (!data) {
    return data;
  }

  const result = { ...data };

  // Handle email if present
  if (data.email) {
    result.email = data.email.includes('@')
      ? data.email.replace('@', `+${TEST_IDENTIFIER}@`)
      : `${data.email}+${TEST_IDENTIFIER}@example.com`;
  }

  // Handle username if present
  if (data.username) {
    result.username = `${data.username}_${TEST_IDENTIFIER}`;
  }

  // Handle name if present (for organizations)
  if (data.name) {
    result.name = `${data.name}_${TEST_IDENTIFIER}`;
  }

  return result;
}

/**
 * Helper function to find a test user by email
 */
export async function findTestUser(email) {
  if (!email) {
    return null;
  }

  const uniqueEmail = email.includes('@')
    ? email.replace('@', `+${TEST_IDENTIFIER}@`)
    : `${email}+${TEST_IDENTIFIER}@example.com`;

  return prisma.user.findUnique({
    where: { email: uniqueEmail },
  });
}

// Export the prisma client as default
export default prisma;

// In src/__tests__/db.setup.js or a new mock file
jest.mock('../strategies/google-strategy', () => ({
  configureGoogleStrategy: jest.fn(),
}));
