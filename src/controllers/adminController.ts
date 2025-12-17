import { FastifyRequest, FastifyReply } from 'fastify';
import { threadLockService } from '../services/threadLockService';

export class AdminController {
  /**
   * Force clear a thread lock
   */
  async clearThreadLock(
    request: FastifyRequest<{
      Params: { thread_id: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { thread_id } = request.params;

      // Get current lock info before clearing
      const isLocked = await threadLockService.isLocked(thread_id);
      const ttl = await threadLockService.getLockTTL(thread_id);
      const activeRun = await threadLockService.getActiveRun(thread_id);

      if (!isLocked) {
        return reply.send({
          success: true,
          message: 'Thread is not locked',
          data: { thread_id, was_locked: false },
        });
      }

      // Force clear the lock
      await threadLockService.forceClearLock(thread_id);

      return reply.send({
        success: true,
        message: 'Thread lock cleared successfully',
        data: {
          thread_id,
          was_locked: true,
          ttl_seconds: ttl,
          active_run: activeRun,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to clear thread lock',
      });
    }
  }

  /**
   * Get thread lock status
   */
  async getThreadLockStatus(
    request: FastifyRequest<{
      Params: { thread_id: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { thread_id } = request.params;

      const isLocked = await threadLockService.isLocked(thread_id);
      const ttl = await threadLockService.getLockTTL(thread_id);
      const activeRun = await threadLockService.getActiveRun(thread_id);

      return reply.send({
        success: true,
        data: {
          thread_id,
          is_locked: isLocked,
          ttl_seconds: ttl,
          active_run: activeRun,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get thread lock status',
      });
    }
  }
}
