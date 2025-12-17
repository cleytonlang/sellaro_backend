import Redis from 'ioredis';

export class ThreadLockService {
  private redis: Redis;
  private readonly LOCK_TTL = 300; // 5 minutes in seconds
  private readonly LOCK_RETRY_DELAY = 1000; // 1 second

  constructor() {
    const upstashUrl = process.env.UPSTASH_REDIS_URL;

    if (upstashUrl) {
      // Parse Upstash URL (format: rediss://default:password@host:port)
      const url = new URL(upstashUrl);
      this.redis = new Redis({
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password,
        username: url.username !== 'default' ? url.username : undefined,
        tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    } else {
      // Fallback to traditional configuration
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    }

    this.redis.on('error', (err) => {
      console.error('Redis connection error in ThreadLockService:', err);
    });
  }

  /**
   * Generates the Redis key for a thread lock
   */
  private getLockKey(threadId: string): string {
    return `thread_lock:${threadId}`;
  }

  /**
   * Generates the Redis key for storing active run ID
   */
  private getActiveRunKey(threadId: string): string {
    return `thread_active_run:${threadId}`;
  }

  /**
   * Attempts to acquire a lock for a thread
   * Returns true if lock was acquired, false otherwise
   */
  async acquireLock(threadId: string, lockId: string): Promise<boolean> {
    try {
      const lockKey = this.getLockKey(threadId);

      // Use SET with NX (only set if not exists) and EX (expiration)
      const result = await this.redis.set(
        lockKey,
        lockId,
        'EX',
        this.LOCK_TTL,
        'NX'
      );

      return result === 'OK';
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return false;
    }
  }

  /**
   * Waits for and acquires a lock for a thread
   * Retries until lock is acquired or timeout is reached
   */
  async waitForLock(threadId: string, lockId: string, maxRetries: number = 300): Promise<boolean> {
    let attempts = 0;

    while (attempts < maxRetries) {
      const acquired = await this.acquireLock(threadId, lockId);

      if (acquired) {
        console.log(`🔒 Lock acquired for thread ${threadId} by ${lockId} after ${attempts + 1} attempt(s)`);
        return true;
      }

      attempts++;

      // Only log and wait if we're going to retry
      if (attempts < maxRetries) {
        // Check if there's an active run (only every 10 attempts to reduce noise)
        if (attempts % 10 === 0) {
          const activeRunId = await this.getActiveRun(threadId);
          if (activeRunId) {
            console.log(`⏳ Waiting for active run ${activeRunId} on thread ${threadId}... (attempt ${attempts}/${maxRetries})`);
          }
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, this.LOCK_RETRY_DELAY));
      }
    }

    console.error(`❌ Failed to acquire lock for thread ${threadId} after ${maxRetries} attempts`);
    return false;
  }

  /**
   * Tries to acquire a lock with a limited number of fast retries
   * Useful when you want to fail fast instead of waiting
   */
  async tryAcquireLock(threadId: string, lockId: string, maxRetries: number = 5): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      const acquired = await this.acquireLock(threadId, lockId);

      if (acquired) {
        console.log(`🔒 Lock acquired for thread ${threadId} by ${lockId}`);
        return true;
      }

      if (i < maxRetries - 1) {
        // Short wait between retries (100ms)
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`⚠️ Failed to acquire lock for thread ${threadId} after ${maxRetries} quick attempts`);
    return false;
  }

  /**
   * Releases a lock for a thread
   * Only releases if the lock is held by the specified lockId
   */
  async releaseLock(threadId: string, lockId: string): Promise<boolean> {
    try {
      const lockKey = this.getLockKey(threadId);

      // Lua script to ensure we only delete if the lock is held by this lockId
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, lockKey, lockId);

      if (result === 1) {
        console.log(`🔓 Lock released for thread ${threadId} by ${lockId}`);
        // Also clear the active run
        await this.clearActiveRun(threadId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error releasing lock:', error);
      return false;
    }
  }

  /**
   * Sets the active run ID for a thread
   */
  async setActiveRun(threadId: string, runId: string): Promise<void> {
    try {
      const activeRunKey = this.getActiveRunKey(threadId);
      await this.redis.set(activeRunKey, runId, 'EX', this.LOCK_TTL);
    } catch (error) {
      console.error('Error setting active run:', error);
    }
  }

  /**
   * Gets the active run ID for a thread
   */
  async getActiveRun(threadId: string): Promise<string | null> {
    try {
      const activeRunKey = this.getActiveRunKey(threadId);
      return await this.redis.get(activeRunKey);
    } catch (error) {
      console.error('Error getting active run:', error);
      return null;
    }
  }

  /**
   * Clears the active run ID for a thread
   */
  async clearActiveRun(threadId: string): Promise<void> {
    try {
      const activeRunKey = this.getActiveRunKey(threadId);
      await this.redis.del(activeRunKey);
    } catch (error) {
      console.error('Error clearing active run:', error);
    }
  }

  /**
   * Extends the lock TTL for a thread
   * Useful for long-running operations
   */
  async extendLock(threadId: string, lockId: string): Promise<boolean> {
    try {
      const lockKey = this.getLockKey(threadId);

      // Lua script to extend TTL only if lock is held by this lockId
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(
        script,
        1,
        lockKey,
        lockId,
        this.LOCK_TTL
      );

      return result === 1;
    } catch (error) {
      console.error('Error extending lock:', error);
      return false;
    }
  }

  /**
   * Checks if a thread is currently locked
   */
  async isLocked(threadId: string): Promise<boolean> {
    try {
      const lockKey = this.getLockKey(threadId);
      const exists = await this.redis.exists(lockKey);
      return exists === 1;
    } catch (error) {
      console.error('Error checking lock:', error);
      return false;
    }
  }

  /**
   * Forces the release of a lock (use with caution)
   * This should only be used for cleanup/debugging
   */
  async forceClearLock(threadId: string): Promise<void> {
    try {
      const lockKey = this.getLockKey(threadId);
      const activeRunKey = this.getActiveRunKey(threadId);

      await this.redis.del(lockKey);
      await this.redis.del(activeRunKey);

      console.log(`🧹 Force cleared lock and active run for thread ${threadId}`);
    } catch (error) {
      console.error('Error force clearing lock:', error);
    }
  }

  /**
   * Gets the remaining TTL of a lock in seconds
   */
  async getLockTTL(threadId: string): Promise<number> {
    try {
      const lockKey = this.getLockKey(threadId);
      return await this.redis.ttl(lockKey);
    } catch (error) {
      console.error('Error getting lock TTL:', error);
      return -1;
    }
  }

  /**
   * Closes the Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const threadLockService = new ThreadLockService();
