import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsController } from '../controllers/analyticsController';

const analyticsController = new AnalyticsController();

export async function analyticsRoutes(fastify: FastifyInstance) {
  // Get leads created per day (last 30 days)
  fastify.get<{
    Querystring: { userId: string };
  }>('/analytics/leads-created', async (request, reply) => {
    return analyticsController.getLeadsCreatedPerDay(request, reply);
  });

  // Get leads updated per day (last 30 days)
  fastify.get<{
    Querystring: { userId: string };
  }>('/analytics/leads-updated', async (request, reply) => {
    return analyticsController.getLeadsUpdatedPerDay(request, reply);
  });

  // Get messages per day (last 30 days)
  fastify.get<{
    Querystring: { userId: string };
  }>('/analytics/messages', async (request, reply) => {
    return analyticsController.getMessagesPerDay(request, reply);
  });
}
