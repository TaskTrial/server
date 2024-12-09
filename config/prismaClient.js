const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // ... you will write your Prisma Client queries here
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    /* eslint no-console: off */
    console.error(err.message);
    await prisma.$disconnect();

    /* eslint no-undef: off */
    process.exit(1);
  });
