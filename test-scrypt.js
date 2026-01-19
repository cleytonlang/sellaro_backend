const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function testScrypt() {
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

    // Testar com uma senha de teste usando scrypt
    const testPassword = 'Test1234';
    console.log('\n=== Testing scrypt with password:', testPassword, '===\n');

    // Gerar hash com scrypt (mesmo que o código atualizado)
    const testSalt = crypto.randomBytes(16).toString('hex');
    const testHash = await new Promise((resolve, reject) => {
      crypto.scrypt(testPassword, testSalt, 64, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });

    const testCombined = `${testSalt}:${testHash}`;
    console.log('Generated hash:', testCombined);
    console.log('Length:', testCombined.length);
    console.log('Salt length:', testSalt.length);
    console.log('Hash length:', testHash.length);

    // Verificar se conseguimos validar o hash gerado
    const [verSalt, verHash] = testCombined.split(':');
    const verifyHash = await new Promise((resolve, reject) => {
      crypto.scrypt(testPassword, verSalt, 64, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });

    console.log('\nValidation test:');
    console.log('Original hash:', verHash);
    console.log('Verify hash  :', verifyHash);
    console.log('Match:', verHash === verifyHash ? '✓ YES' : '✗ NO');

    // Comparar formato com o hash que funciona
    console.log('\n=== Format Comparison ===');
    console.log('Working hash length:', workingAccount.password.length);
    console.log('Test hash length   :', testCombined.length);
    console.log('Formats match:', workingAccount.password.length === testCombined.length ? '✓' : '✗');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testScrypt();
