const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEmailLabels() {
  try {
    // Get a recent lead with its form
    const lead = await prisma.lead.findFirst({
      select: {
        form_data: true,
        form_id: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (!lead) {
      console.log('No leads found');
      return;
    }

    console.log('Lead form_data:');
    console.log(JSON.stringify(lead.form_data, null, 2));

    // Fetch form to get field labels
    const form = await prisma.form.findUnique({
      where: { id: lead.form_id },
      select: { fields: true },
    });

    // Create a map of field IDs to labels
    const fieldLabelsMap = {};
    if (form && form.fields && Array.isArray(form.fields)) {
      for (const field of form.fields) {
        if (field.id && field.label) {
          fieldLabelsMap[field.id] = field.label;
        }
      }
    }

    console.log('\nField Labels Map:');
    console.log(JSON.stringify(fieldLabelsMap, null, 2));

    console.log('\nEmail output would be:');
    Object.entries(lead.form_data).forEach(([key, value]) => {
      const label = fieldLabelsMap[key] || key;
      console.log(`${label}: ${value}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEmailLabels();
