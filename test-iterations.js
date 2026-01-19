const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function testIterations() {
  try {
    // Buscar uma conta que funciona (criada pelo Better Auth)
    const workingAccount = await prisma.account.findFirst({
      where: {
        providerId: 'credential',
        password: { not: null },
      },
      include: {
        user: true,
      },
    });

    if (!workingAccount) {
      console.log('No working account found');
      return;
    }

    console.log('Working account found:', workingAccount.user.email);
    console.log('Hash:', workingAccount.password);
    console.log('Hash length:', workingAccount.password.length);

    // Parse o hash
    const [salt, hash] = workingAccount.password.split(':');
    console.log('\nSalt:', salt);
    console.log('Salt length:', salt.length);
    console.log('Hash:', hash);
    console.log('Hash length:', hash.length);

    // Vamos criar um novo hash com uma senha de teste
    const testPassword = 'TestPassword123';
    console.log('\n=== Testing different iterations with password:', testPassword, '===\n');

    const iterations = [1, 10, 100, 1000, 5000, 10000, 50000, 100000, 310000];

    for (const iter of iterations) {
      const testSalt = crypto.randomBytes(16).toString('hex');
      const testHash = crypto.pbkdf2Sync(testPassword, testSalt, iter, 64, 'sha256').toString('hex');
      const combined = `${testSalt}:${testHash}`;

      // Verificar se conseguimos validar de volta
      const [extractedSalt, extractedHash] = combined.split(':');
      const verifyHash = crypto.pbkdf2Sync(testPassword, extractedSalt, iter, 64, 'sha256').toString('hex');
      const valid = verifyHash === extractedHash;

      console.log(`${iter.toString().padStart(6)} iterations: length=${combined.length}, valid=${valid ? '✓' : '✗'}`);
    }

    // Verificar qual formato o Better Auth usa verificando o comprimento
    console.log('\n=== Format Analysis ===');
    console.log('Working hash format: salt:hash');
    console.log('Expected total length: 161 chars (32 + 1 + 128)');
    console.log('Actual length:', workingAccount.password.length);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testIterations();
