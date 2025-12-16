import { FastifyRequest, FastifyReply } from 'fastify';
import { openaiService } from '../services/openaiService';
import { auth } from '../lib/auth';

export class ThreadController {
  async getThreadMessages(
    request: FastifyRequest<{
      Params: { threadId: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { threadId } = request.params;

      // Get session from better-auth using cookies
      const session = await auth.api.getSession({
        headers: request.headers as any,
      });

      if (!session?.user?.id) {
        return reply.status(401).send({
          success: false,
          error: 'Unauthorized - Please login',
        });
      }

      const userId = session.user.id;

      // Fetch messages from OpenAI
      const messages = await openaiService.getThreadMessages(userId, threadId);

      if (messages === null) {
        return reply.status(404).send({
          success: false,
          error: 'Thread not found or error fetching messages',
        });
      }

      return reply.send({
        success: true,
        data: {
          threadId,
          messages,
          totalMessages: messages.length,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch thread messages',
      });
    }
  }
}
