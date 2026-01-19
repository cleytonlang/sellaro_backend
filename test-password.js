const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testPassword() {
  try {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
      console.log('Usage: node test-password.js <email> <password>');
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

    console.log('User found:', user.email);

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

    console.log('Account found:', {
      id: account.id,
      providerId: account.providerId,
      hasPassword: !!account.password,
    });

    if (!account.password) {
      console.log('Account has no password');
      return;
    }

    // Testar senha
    const isValid = await bcrypt.compare(password, account.password);
    console.log('\nPassword test result:', isValid ? 'VALID ✓' : 'INVALID ✗');

    if (!isValid) {
      console.log('\nStored hash (first 50 chars):', account.password.substring(0, 50));
      console.log('Testing password:', password);

      // Gerar novo hash para comparar formato
      const newHash = await bcrypt.hash(password, 10);
      console.log('\nNew hash (first 50 chars):', newHash.substring(0, 50));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword();
