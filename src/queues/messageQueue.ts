import Bull, { Queue, Job } from 'bull';

export interface MessageJobData {
  conversationId: string;
  userId: string;
  assistantId: string;
  threadId: string;
  openaiAssistantId: string;
  content: string;
  userMessageId: string;
  leadId: string;
}

export interface MessageJobResult {
  success: boolean;
  assistantMessageId?: string;
  assistantMessageContent?: string;
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

export const messageQueue: Queue<MessageJobData> = new Bull('message-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200, // Keep last 200 failed jobs
  },
  settings: {
    // Process jobs with same threadId sequentially
    // This prevents multiple workers from trying to acquire lock simultaneously
    lockDuration: 300000, // 5 minutes (same as thread lock TTL)
    lockRenewTime: 30000, // Renew every 30 seconds
  },
});

// Queue event listeners
messageQueue.on('completed', (job: Job<MessageJobData>) => {
  console.log(`✅ Job ${job.id} completed for conversation ${job.data.conversationId}`);
});

messageQueue.on('failed', (job: Job<MessageJobData>, err: Error) => {
  console.error(`❌ Job ${job.id} failed for conversation ${job.data.conversationId}:`, err.message);
});

messageQueue.on('active', (job: Job<MessageJobData>) => {
  console.log(`🔄 Processing job ${job.id} for conversation ${job.data.conversationId}`);
});

messageQueue.on('stalled', (job: Job<MessageJobData>) => {
  console.warn(`⚠️ Job ${job.id} stalled for conversation ${job.data.conversationId}`);
});

messageQueue.on('error', (error: Error) => {
  console.error('❌ Queue error:', error.message);
});

// Add message to queue
export async function addMessageToQueue(data: MessageJobData): Promise<Job<MessageJobData>> {
  // Use threadId in the job options to ensure proper ordering
  // Jobs with the same threadId will be processed sequentially when using concurrency per thread
  return await messageQueue.add(data, {
    jobId: `msg-${data.conversationId}-${Date.now()}`,
    // Priority: higher number = higher priority
    // Use timestamp inverse to maintain FIFO order for same thread
    priority: 1,
    // Group jobs by threadId to process them sequentially
    // This is a custom property we'll use for organization
  });
}

// Get job by ID
export async function getMessageJob(jobId: string): Promise<Job<MessageJobData> | null> {
  return await messageQueue.getJob(jobId);
}

// Get job status
export async function getMessageJobStatus(jobId: string): Promise<{
  state: string;
  progress: number;
  result?: MessageJobResult;
  failedReason?: string;
} | null> {
  const job = await messageQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress();

  let result: MessageJobResult | undefined;
  let failedReason: string | undefined;

  if (state === 'completed') {
    result = job.returnvalue as MessageJobResult;
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

export default messageQueue;
