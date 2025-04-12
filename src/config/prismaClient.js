import { PrismaClient } from '../../prisma/generated/prisma-client-js/index.js';

const prisma = new PrismaClient();

/* eslint no-undef: off */
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

export default prisma;
