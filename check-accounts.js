const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAccounts() {
  try {
    const accounts = await prisma.account.findMany({
      take: 10,
      select: {
        id: true,
        providerId: true,
        accountId: true,
        userId: true,
        password: true,
      },
    });

    console.log('Accounts found:', accounts.length);
    accounts.forEach((acc, idx) => {
      console.log(`\n[${idx + 1}] Account:`, {
        id: acc.id,
        providerId: acc.providerId,
        userId: acc.userId,
        hasPassword: !!acc.password,
      });
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccounts();
