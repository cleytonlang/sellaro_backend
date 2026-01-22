import { FastifyInstance } from 'fastify';
import { AnalyticsController } from '../controllers/analyticsController';
import { authMiddleware } from '../middlewares/auth';

const analyticsController = new AnalyticsController();

export async function analyticsRoutes(fastify: FastifyInstance) {
  // Todas as rotas de analytics requerem autenticação
  // O userId agora vem do request.user (validado pelo middleware)
  fastify.get('/analytics/leads-created',
    { preHandler: authMiddleware },
    async (request, reply) => {
      return analyticsController.getLeadsCreatedPerDay(request as any, reply);
    }
  );

  fastify.get('/analytics/leads-updated',
    { preHandler: authMiddleware },
    async (request, reply) => {
      return analyticsController.getLeadsUpdatedPerDay(request as any, reply);
    }
  );

  fastify.get('/analytics/messages',
    { preHandler: authMiddleware },
    async (request, reply) => {
      return analyticsController.getMessagesPerDay(request as any, reply);
    }
  );
}
