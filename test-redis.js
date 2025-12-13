require('dotenv').config();

// Support both Upstash SDK and ioredis for traditional Redis
const upstashUrl = process.env.UPSTASH_REDIS_URL;

if (upstashUrl) {
  // Fall back to ioredis for protocol testing
  const IORedis = require('ioredis');
  const redis = new IORedis(upstashUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: {
      rejectUnauthorized: false,
    },
  });

  redis.on('connect', () => {
    console.log('✅ Connected to Upstash Redis');
  });

  redis.on('ready', () => {
    console.log('✅ Redis is ready\n');
    console.log('⏳ Running tests...\n');

    // Test basic operations
    Promise.all([
      redis.ping(),
      redis.set('test-key', 'Hello Upstash Redis'),
      redis.get('test-key'),
      redis.del('test-key'),
    ])
      .then(([pingResult, setResult, getValue, delResult]) => {
        console.log(`✅ PING: ${pingResult}`);
        console.log(`✅ SET: ${setResult}`);
        console.log(`✅ GET: ${getValue}`);
        console.log(`✅ DEL: ${delResult} key(s) deleted`);

        console.log('\n📊 Test Summary:');
        console.log('  ✅ Connection: Success');
        console.log('  ✅ Write operations: Success');
        console.log('  ✅ Read operations: Success');
        console.log('  ✅ Delete operations: Success');
        console.log('\n🎉 All tests passed! Upstash Redis is working correctly.');
        console.log('💡 Your backend is ready to process message queues with Bull.');

        redis.quit();
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Test failed:', error.message);
        console.log('\n💡 Upstash Troubleshooting:');
        console.log('  1. Verify your UPSTASH_REDIS_URL is correct');
        console.log('  2. Make sure the URL starts with rediss:// (with TLS)');
        console.log('  3. Check your Upstash dashboard: https://console.upstash.com');
        console.log('  4. Verify the database is active and not paused');
        console.log('  5. Copy the URL exactly from Upstash (Redis URL, not REST URL)');
        console.log('\nSee UPSTASH_SETUP.md for detailed instructions.');
        redis.quit();
        process.exit(1);
      });
  });

  redis.on('error', (error) => {
    console.error('❌ Redis connection error:', error.message);
    console.log('\n💡 Check your UPSTASH_REDIS_URL in .env file');
    process.exit(1);
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    console.error('\n⏱️ Connection timeout - Upstash is not responding');
    console.log('\n💡 Upstash Troubleshooting:');
    console.log('  1. Verify your UPSTASH_REDIS_URL is correct');
    console.log('  2. Make sure the URL starts with rediss:// (with TLS)');
    console.log('  3. Check your Upstash dashboard: https://console.upstash.com');
    console.log('  4. Verify the database is active and not paused');
    redis.quit();
    process.exit(1);
  }, 10000);

} else {
  // Use ioredis for traditional Redis
  console.log('🔍 Testing traditional Redis connection with ioredis...');

  const Redis = require('ioredis');

  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379');
  console.log(`📍 Host: ${host}:${port}`);
  console.log('📦 Using: ioredis\n');

  const redis = new Redis({
    host,
    port,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('❌ Failed to connect to Redis after 3 attempts');
        return null;
      }
      console.log(`⏳ Retry attempt ${times}...`);
      return Math.min(times * 200, 1000);
    },
  });

  redis.on('connect', () => {
    console.log('✅ Connected to Redis');
  });

  redis.on('ready', () => {
    console.log('✅ Redis is ready\n');

    // Test basic operations
    Promise.all([
      redis.ping(),
      redis.set('test-key', 'Hello Redis'),
      redis.get('test-key'),
      redis.del('test-key'),
    ])
      .then(([pingResult, setResult, getValue, delResult]) => {
        console.log('📊 Test Results:');
        console.log(`  PING: ${pingResult}`);
        console.log(`  SET: ${setResult}`);
        console.log(`  GET: ${getValue}`);
        console.log(`  DEL: ${delResult} key(s) deleted`);
        console.log('\n✅ All tests passed! Redis is working correctly.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
      });
  });

  redis.on('error', (error) => {
    console.error('❌ Redis error:', error.message);
  });

  redis.on('close', () => {
    console.log('🔌 Redis connection closed');
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    console.error('\n⏱️ Connection timeout - Redis is not responding');
    console.log('\n💡 Local Redis Troubleshooting:');
    console.log('  1. Make sure Redis is running (docker, WSL, or native)');
    console.log('  2. Check if port 6379 is accessible');
    console.log('  3. Verify your .env configuration (REDIS_HOST, REDIS_PORT)');
    console.log('\nOr use Upstash (recommended):');
    console.log('  - Set UPSTASH_REDIS_URL in your .env');
    console.log('  - See UPSTASH_SETUP.md for setup instructions');
    process.exit(1);
  }, 10000);
}
