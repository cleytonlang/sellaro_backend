const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai').default;
const { decryptToken } = require('./dist/utils/crypto.js');

const prisma = new PrismaClient();

(async () => {
  try {
    // Get Gabriela assistant
    const assistant = await prisma.assistant.findUnique({
      where: { id: 'cmj7y3sj80075np0qt7on8fdu' },
      include: {
        user: {
          select: { openai_api_key: true }
        }
      }
    });

    if (!assistant || !assistant.user?.openai_api_key) {
      console.log('Assistant or API key not found');
      await prisma.$disconnect();
      return;
    }

    const apiKey = decryptToken(assistant.user.openai_api_key);
    const openai = new OpenAI({ apiKey });

    // Get assistant from OpenAI
    const openaiAssistant = await openai.beta.assistants.retrieve(assistant.openai_assistant_id);

    console.log('OpenAI Assistant Configuration:');
    console.log('ID:', openaiAssistant.id);
    console.log('Name:', openaiAssistant.name);
    console.log('Tools:', JSON.stringify(openaiAssistant.tools, null, 2));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
})();
