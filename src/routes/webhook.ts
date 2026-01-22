import { FastifyInstance } from 'fastify';
import { WebhookController } from '../controllers/webhookController';
import { authMiddleware } from '../middlewares/auth';

const webhookController = new WebhookController();

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: authMiddleware }, webhookController.create.bind(webhookController) as any);
  fastify.get('/column/:columnId', { preHandler: authMiddleware }, webhookController.getByColumn.bind(webhookController) as any);
  fastify.put('/:id', { preHandler: authMiddleware }, webhookController.update.bind(webhookController) as any);
  fastify.delete('/:id', { preHandler: authMiddleware }, webhookController.delete.bind(webhookController) as any);
  fastify.patch('/:id/toggle', { preHandler: authMiddleware }, webhookController.toggleActive.bind(webhookController) as any);
}
