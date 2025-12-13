import { FastifyInstance } from 'fastify';
import { ConversationController } from '../controllers/conversationController';

const conversationController = new ConversationController();

export default async function conversationRoutes(fastify: FastifyInstance) {
  fastify.post('/', conversationController.create);
  fastify.get('/', conversationController.getAll);
  fastify.get('/:id', conversationController.getById);
  fastify.post('/:id/messages', conversationController.addMessage);
  fastify.get('/:id/messages/status', conversationController.getMessageStatus);
  fastify.put('/:id', conversationController.update);
}
