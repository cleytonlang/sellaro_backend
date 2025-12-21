/**
 * Example test file for emailService
 *
 * To test the email service:
 * 1. Add RESEND_API_KEY to your .env file
 * 2. Add RESEND_FROM_EMAIL to your .env file (or use onboarding@resend.dev for testing)
 * 3. Run: npx tsx src/services/emailService.test.example.ts
 */

import { emailService } from './emailService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');

  // Check if API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not found in .env file');
    console.log('Please add RESEND_API_KEY=re_your_key_here to your .env file');
    process.exit(1);
  }

  console.log('✅ RESEND_API_KEY found');
  console.log(`📧 From email: ${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}\n`);

  // Test data
  const testLeadData = {
    nome: 'João Silva',
    email: 'joao@example.com',
    telefone: '(11) 98765-4321',
    empresa: 'Empresa Teste LTDA',
    cargo: 'Gerente de Vendas',
  };

  try {
    console.log('📤 Sending test email...\n');

    const result = await emailService.sendLeadEmail(
      'your-test-email@example.com', // ⚠️ CHANGE THIS to your email
      'Test Email - Lead Capturado',
      'Este é um email de teste do sistema de triggers. Um novo lead foi capturado!',
      testLeadData,
      'test-form-id' // Test form ID
    );

    console.log('✅ Email sent successfully!');
    console.log('📊 Result:', result);
    console.log('\n📨 Check your inbox!');
  } catch (error) {
    console.error('❌ Error sending email:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testEmailService();
