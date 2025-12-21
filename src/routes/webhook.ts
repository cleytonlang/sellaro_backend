import { FastifyInstance } from 'fastify';
import { WebhookController } from '../controllers/webhookController';

const webhookController = new WebhookController();

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/', webhookController.create);
  fastify.get('/column/:columnId', webhookController.getByColumn);
  fastify.delete('/:id', webhookController.delete);
  fastify.patch('/:id/toggle', webhookController.toggleActive);
}
