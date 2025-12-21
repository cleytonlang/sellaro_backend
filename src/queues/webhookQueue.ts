import Bull, { Queue, Job } from 'bull';

export interface WebhookJobData {
  webhookId: string;
  webhookUrl: string;
  leadId: string;
  columnId: string;
  columnName: string;
  leadData: Record<string, any>;
  timestamp: string;
}

export interface WebhookJobResult {
  success: boolean;
  statusCode?: number;
  responseBody?: any;
  error?: string;
}

// Create Bull queue with Redis connection (supports Upstash)
const getRedisConfig = () => {
  const upstashUrl = process.env.UPSTASH_REDIS_URL;

  if (upstashUrl) {
    // Parse Upstash URL (format: rediss://default:password@host:port)
    const url = new URL(upstashUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password,
      username: url.username !== 'default' ? url.username : undefined,
      tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
    };
  }

  // Fallback to traditional configuration
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  };
};

const redisConfig = getRedisConfig();

export const webhookQueue: Queue<WebhookJobData> = new Bull('webhook-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 seconds
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200, // Keep last 200 failed jobs
    timeout: 30000, // 30 seconds timeout for webhook calls
  },
  settings: {
    lockDuration: 60000, // 1 minute
    lockRenewTime: 10000, // Renew every 10 seconds
  },
});

// Queue event listeners
webhookQueue.on('completed', (job: Job<WebhookJobData>) => {
  console.log(`✅ Webhook job ${job.id} completed for lead ${job.data.leadId}`);
});

webhookQueue.on('failed', (job: Job<WebhookJobData>, err: Error) => {
  console.error(`❌ Webhook job ${job.id} failed for lead ${job.data.leadId}:`, err.message);
});

webhookQueue.on('active', (job: Job<WebhookJobData>) => {
  console.log(`🔄 Processing webhook job ${job.id} for lead ${job.data.leadId}`);
});

webhookQueue.on('stalled', (job: Job<WebhookJobData>) => {
  console.warn(`⚠️ Webhook job ${job.id} stalled for lead ${job.data.leadId}`);
});

webhookQueue.on('error', (error: Error) => {
  console.error('❌ Webhook queue error:', error.message);
});

// Add webhook to queue
export async function addWebhookToQueue(data: WebhookJobData): Promise<Job<WebhookJobData>> {
  return await webhookQueue.add(data, {
    jobId: `webhook-${data.webhookId}-${data.leadId}-${Date.now()}`,
    priority: 1,
  });
}

// Get job by ID
export async function getWebhookJob(jobId: string): Promise<Job<WebhookJobData> | null> {
  return await webhookQueue.getJob(jobId);
}

// Get job status
export async function getWebhookJobStatus(jobId: string): Promise<{
  state: string;
  progress: number;
  result?: WebhookJobResult;
  failedReason?: string;
} | null> {
  const job = await webhookQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress();

  let result: WebhookJobResult | undefined;
  let failedReason: string | undefined;

  if (state === 'completed') {
    result = job.returnvalue as WebhookJobResult;
  } else if (state === 'failed') {
    failedReason = job.failedReason;
  }

  return {
    state,
    progress: typeof progress === 'number' ? progress : 0,
    result,
    failedReason,
  };
}

export default webhookQueue;
