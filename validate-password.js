const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function validatePassword() {
  try {
    const email = process.argv[2];
    const password = process.argv[3];

    console.log(process.argv);

    if (!email || !password) {
      console.log('Usage: node validate-password.js <email> <password>');
      return;
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    // Buscar account
    const account = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: 'credential',
      },
    });

    if (!account) {
      console.log('Account not found');
      return;
    }

    console.log('Account found:');
    console.log('- Email:', email);
    console.log('- Hash:', account.password);
    console.log('- Hash length:', account.password.length);

    // Parse hash
    const [salt, hash] = account.password.split(':');
    console.log('\nHash components:');
    console.log('- Salt length:', salt.length);
    console.log('- Hash length:', hash.length);

    // Test with different iterations
    console.log('\nTesting with password:', password);

    const iterations = [10000, 100000, 310000];
    for (const iter of iterations) {
      const testHash = crypto.pbkdf2Sync(password, salt, iter, 64, 'sha256').toString('hex');
      const matches = testHash === hash;
      console.log(`- ${iter} iterations: ${matches ? 'MATCH ✓' : 'no match'}`);
      if (matches) {
        console.log('\n✓ FOUND CORRECT ITERATIONS:', iter);
        break;
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validatePassword();
