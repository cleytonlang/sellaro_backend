import { FastifyInstance } from 'fastify';
import { ConversationController } from '../controllers/conversationController';
import { optionalAuthMiddleware } from '../middlewares/auth';

const conversationController = new ConversationController();

export default async function conversationRoutes(fastify: FastifyInstance) {
  fastify.post('/', conversationController.create);
  fastify.get('/', conversationController.getAll);
  // Rota pública com autenticação opcional (permite acesso público para conversações de formulários)
  fastify.get('/:id', { preHandler: optionalAuthMiddleware }, conversationController.getById);
  // Rota pública com autenticação opcional (permite envio de mensagens em conversações de formulários)
  fastify.post('/:id/messages', { preHandler: optionalAuthMiddleware }, conversationController.addMessage);
  // Rota pública com autenticação opcional (permite verificar status de mensagens em conversações de formulários)
  fastify.get('/:id/messages/status', { preHandler: optionalAuthMiddleware }, conversationController.getMessageStatus);
  fastify.put('/:id', conversationController.update);
}
