import { Job } from 'bull';
import { webhookQueue, WebhookJobData, WebhookJobResult } from '../queues/webhookQueue';
import prisma from '../utils/prisma';

// Process webhook job
webhookQueue.process(async (job: Job<WebhookJobData>): Promise<WebhookJobResult> => {
  const {
    webhookId,
    webhookUrl,
    leadId,
    columnId,
    columnName,
    leadData,
    timestamp,
  } = job.data;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔗 [WEBHOOK ${job.id}] STARTED - Attempt ${job.attemptsMade + 1}/${job.opts.attempts}`);
  console.log(`📍 URL: ${webhookUrl}`);
  console.log(`👤 Lead: ${leadId}`);
  console.log(`📊 Column: ${columnName} (${columnId})`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Verify webhook is still active and get auth config
    console.log(`[WEBHOOK ${job.id}] Verifying webhook and fetching auth config...`);
    const webhook = await prisma.columnWebhook.findUnique({
      where: { id: webhookId },
      select: {
        is_active: true,
        auth_type: true,
        header_name: true,
        header_value: true,
        basic_auth_user: true,
        basic_auth_pass: true,
        bearer_token: true,
      },
    });

    if (!webhook) {
      console.log(`[WEBHOOK ${job.id}] ⚠️ Webhook ${webhookId} not found - skipping`);
      return {
        success: false,
        error: 'Webhook not found',
      };
    }

    if (!webhook.is_active) {
      console.log(`[WEBHOOK ${job.id}] ⚠️ Webhook ${webhookId} is inactive - skipping`);
      return {
        success: false,
        error: 'Webhook is inactive',
      };
    }

    // Prepare payload
    const payload = {
      event: 'lead.moved',
      timestamp,
      lead: {
        id: leadId,
        data: leadData,
      },
      column: {
        id: columnId,
        name: columnName,
      },
    };

    // Build headers with authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Sellaro-Webhook/1.0',
      'X-Webhook-ID': webhookId,
      'X-Lead-ID': leadId,
    };

    // Add authentication headers based on auth_type
    if (webhook.auth_type === 'header_token' && webhook.header_name && webhook.header_value) {
      headers[webhook.header_name] = webhook.header_value;
      console.log(`[WEBHOOK ${job.id}] 🔐 Using Header Token authentication (${webhook.header_name})`);
    } else if (webhook.auth_type === 'basic_auth' && webhook.basic_auth_user && webhook.basic_auth_pass) {
      const credentials = Buffer.from(`${webhook.basic_auth_user}:${webhook.basic_auth_pass}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
      console.log(`[WEBHOOK ${job.id}] 🔐 Using Basic Auth authentication`);
    } else if (webhook.auth_type === 'bearer_token' && webhook.bearer_token) {
      headers['Authorization'] = `Bearer ${webhook.bearer_token}`;
      console.log(`[WEBHOOK ${job.id}] 🔐 Using Bearer Token authentication`);
    } else {
      console.log(`[WEBHOOK ${job.id}] 🔓 No authentication configured`);
    }

    console.log(`[WEBHOOK ${job.id}] Sending POST request to ${webhookUrl}...`);
    console.log(`[WEBHOOK ${job.id}] Payload:`, JSON.stringify(payload, null, 2));

    // Update job progress
    await job.progress(30);

    // Make HTTP POST request to webhook URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    await job.progress(70);

    console.log(`[WEBHOOK ${job.id}] Response status: ${response.status}`);

    let responseBody: any;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    console.log(`[WEBHOOK ${job.id}] Response body:`, responseBody);

    await job.progress(90);

    // Check if response is successful (2xx status codes)
    const isSuccess = response.status >= 200 && response.status < 300;

    if (!isSuccess) {
      console.warn(`[WEBHOOK ${job.id}] ⚠️ Webhook returned non-2xx status: ${response.status}`);

      // If it's a client error (4xx), don't retry
      if (response.status >= 400 && response.status < 500) {
        console.log(`[WEBHOOK ${job.id}] Client error (4xx) - not retrying`);
        return {
          success: false,
          statusCode: response.status,
          responseBody,
          error: `Client error: ${response.status}`,
        };
      }

      // For server errors (5xx), throw to trigger retry
      throw new Error(`Server error: ${response.status} - ${JSON.stringify(responseBody)}`);
    }

    await job.progress(100);

    console.log(`[WEBHOOK ${job.id}] ✅ Webhook call completed successfully\n`);

    return {
      success: true,
      statusCode: response.status,
      responseBody,
    };
  } catch (error) {
    console.error(`\n${'='.repeat(80)}`);
    console.error(`❌ [WEBHOOK ${job.id}] ERROR calling webhook`);
    console.error(`🔄 Attempt ${job.attemptsMade + 1} of ${job.opts.attempts}`);
    console.error(`📋 Error details:`, error);

    if (error instanceof Error) {
      console.error(`📝 Error message: ${error.message}`);
      console.error(`📚 Error stack:`, error.stack);
    }
    console.error(`${'='.repeat(80)}\n`);

    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[WEBHOOK ${job.id}] ⏱️ Webhook request timed out`);
      throw new Error('Webhook request timed out');
    }

    // Check if it's a network error
    if (error instanceof Error && error.message.includes('fetch failed')) {
      console.log(`[WEBHOOK ${job.id}] 🌐 Network error - unable to reach webhook URL`);
      throw new Error('Network error: Unable to reach webhook URL');
    }

    // Re-throw the error to trigger Bull retry mechanism
    throw error;
  }
});

console.log('🚀 Webhook worker started and listening for jobs...');

export default webhookQueue;
