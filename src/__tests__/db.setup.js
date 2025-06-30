// Database setup for integration tests
import { beforeAll, afterAll } from '@jest/globals';
import prisma from '../config/prismaClient.js';
import { server } from './mocks/index.mock.js';

/* eslint no-unused-vars: off */
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

  // Clean up test data created with this identifier if environment variable is set
  if (process.env.CLEAN_TEST_DATA === 'true') {
    await cleanupTestData();
  }

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
 * Clean up test data created with the current TEST_IDENTIFIER
 * This will remove all data marked with the current test identifier
 */
export async function cleanupTestData() {
  try {
    console.log(`Cleaning up test data with identifier: ${TEST_IDENTIFIER}`);

    // Clean up users with test emails
    const usersDeleted = await prisma.user.deleteMany({
      where: {
        email: {
          contains: `+${TEST_IDENTIFIER}@`,
        },
      },
    });
    console.log(`Deleted ${usersDeleted.count} test users`);

    // Clean up organizations with test names
    const orgsDeleted = await prisma.organization.deleteMany({
      where: {
        name: {
          contains: `_${TEST_IDENTIFIER}`,
        },
      },
    });
    console.log(`Deleted ${orgsDeleted.count} test organizations`);

    // Clean up departments with test names
    const deptsDeleted = await prisma.department.deleteMany({
      where: {
        name: {
          contains: `_${TEST_IDENTIFIER}`,
        },
      },
    });
    console.log(`Deleted ${deptsDeleted.count} test departments`);

    // Clean up teams with test names
    const teamsDeleted = await prisma.team.deleteMany({
      where: {
        name: {
          contains: `_${TEST_IDENTIFIER}`,
        },
      },
    });
    console.log(`Deleted ${teamsDeleted.count} test teams`);

    // Clean up projects with test names
    const projectsDeleted = await prisma.project.deleteMany({
      where: {
        name: {
          contains: `_${TEST_IDENTIFIER}`,
        },
      },
    });
    console.log(`Deleted ${projectsDeleted.count} test projects`);

    // Clean up sprints with test names
    const sprintsDeleted = await prisma.sprint.deleteMany({
      where: {
        name: {
          contains: `_${TEST_IDENTIFIER}`,
        },
      },
    });
    console.log(`Deleted ${sprintsDeleted.count} test sprints`);
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

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
