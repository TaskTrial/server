const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/* eslint no-undef: off */
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

module.exports = prisma;
