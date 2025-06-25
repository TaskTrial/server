/* eslint-env node */
import { PrismaClient } from '../../prisma/generated/prisma-client-js/index.js';

// Check if we're in a test environment
const isTest = process.env.NODE_ENV === 'test';
const isUnitTest = process.env.UNIT_TEST === '1';

// For unit tests, we'll use the mock Prisma client
// For integration tests and production, we'll use the real Prisma client
let prisma;

if (isTest && isUnitTest) {
  // For unit tests, we'll import the mock from the setup file
  // The actual mock will be injected by Jest
  prisma = {};
} else {
  // For integration tests and production, use the real Prisma client
  prisma = new PrismaClient();
}

/* eslint no-undef: off */
process.on('SIGINT', async () => {
  if (!isTest || !isUnitTest) {
    await prisma.$disconnect();
  }
  process.exit();
});

export default prisma;
