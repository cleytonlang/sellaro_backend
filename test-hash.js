const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testHash() {
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

    console.log('Working account found:');
    console.log('- Email:', workingAccount.user.email);
    console.log('- Password hash:', workingAccount.password);
    console.log('- Hash length:', workingAccount.password.length);
    console.log('- Hash prefix:', workingAccount.password.substring(0, 7));

    // Testar se é bcrypt válido
    const testPassword = 'Test1234';
    console.log('\nTesting with password:', testPassword);

    // Gerar novo hash com bcrypt padrão
    const newHash = await bcrypt.hash(testPassword, 10);
    console.log('\nNew bcrypt hash:', newHash);
    console.log('- Hash length:', newHash.length);
    console.log('- Hash prefix:', newHash.substring(0, 7));

    // Comparar formatos
    console.log('\nFormat comparison:');
    console.log('Working hash starts with:', workingAccount.password.substring(0, 4));
    console.log('New hash starts with:', newHash.substring(0, 4));
    console.log('Formats match:', workingAccount.password.substring(0, 4) === newHash.substring(0, 4));

    // Tentar validar o hash que funciona
    const workingHashValid = workingAccount.password.startsWith('$2');
    console.log('\nWorking hash is valid bcrypt format:', workingHashValid);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testHash();
