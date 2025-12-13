import Redis from 'ioredis';

// Support both Upstash URL and traditional host/port configuration
const upstashUrl = process.env.UPSTASH_REDIS_URL;

// Create Redis client with appropriate configuration
export const redisClient = upstashUrl
  ? new Redis(upstashUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      tls: {
        rejectUnauthorized: false,
      },
    })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('ready', () => {
  console.log('✅ Redis is ready to accept commands');
});

redisClient.on('error', (error) => {
  console.error('❌ Redis connection error:', error.message);
});

redisClient.on('close', () => {
  console.warn('⚠️ Redis connection closed');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Reconnecting to Redis...');
});

export default redisClient;
