// Standalone script to clean up test data
import prisma from '../../../src/config/prismaClient.js';

/* eslint no-console: off */

/**
 * Clean up ALL test data regardless of test identifier
 */
async function cleanupAllTestData() {
  try {
    console.log('Starting cleanup of all test data...');

    // Clean up users with test emails (containing '+test_' in email)
    const usersDeleted = await prisma.user.deleteMany({
      where: {
        email: {
          contains: '+test_',
        },
      },
    });
    console.log(`Deleted ${usersDeleted.count} test users`);

    // Clean up organizations with test names (containing '_test_' in name)
    const orgsDeleted = await prisma.organization.deleteMany({
      where: {
        name: {
          contains: '_test_',
        },
      },
    });
    console.log(`Deleted ${orgsDeleted.count} test organizations`);

    // Clean up departments with test names
    const deptsDeleted = await prisma.department.deleteMany({
      where: {
        name: {
          contains: '_test_',
        },
      },
    });
    console.log(`Deleted ${deptsDeleted.count} test departments`);

    // Clean up teams with test names
    const teamsDeleted = await prisma.team.deleteMany({
      where: {
        name: {
          contains: '_test_',
        },
      },
    });
    console.log(`Deleted ${teamsDeleted.count} test teams`);

    // Clean up projects with test names
    const projectsDeleted = await prisma.project.deleteMany({
      where: {
        name: {
          contains: '_test_',
        },
      },
    });
    console.log(`Deleted ${projectsDeleted.count} test projects`);

    // Clean up sprints with test names
    const sprintsDeleted = await prisma.sprint.deleteMany({
      where: {
        name: {
          contains: '_test_',
        },
      },
    });
    console.log(`Deleted ${sprintsDeleted.count} test sprints`);

    console.log('Test data cleanup completed.');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupAllTestData();
