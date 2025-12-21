const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStructure() {
  try {
    // Find a lead with field-default-name
    const lead = await prisma.lead.findFirst({
      include: {
        form: {
          select: {
            fields: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (lead) {
      console.log('Lead form_data:');
      console.log(JSON.stringify(lead.form_data, null, 2));
      console.log('\nForm fields:');
      console.log(JSON.stringify(lead.form.fields, null, 2));
    } else {
      console.log('No leads found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStructure();
