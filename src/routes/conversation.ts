import { FastifyInstance } from 'fastify';
import { ConversationController } from '../controllers/conversationController';
import { optionalAuthMiddleware } from '../middlewares/auth';

const conversationController = new ConversationController();

export default async function conversationRoutes(fastify: FastifyInstance) {
  fastify.post('/', conversationController.create.bind(conversationController) as any);
  fastify.get('/', conversationController.getAll.bind(conversationController) as any);
  // Rota pública com autenticação opcional (permite acesso público para conversações de formulários)
  fastify.get('/:id', { preHandler: optionalAuthMiddleware }, conversationController.getById.bind(conversationController) as any);
  // Rota pública com autenticação opcional (permite envio de mensagens em conversações de formulários)
  fastify.post('/:id/messages', { preHandler: optionalAuthMiddleware }, conversationController.addMessage.bind(conversationController) as any);
  // Rota pública com autenticação opcional (permite verificar status de mensagens em conversações de formulários)
  fastify.get('/:id/messages/status', { preHandler: optionalAuthMiddleware }, conversationController.getMessageStatus.bind(conversationController) as any);
  fastify.put('/:id', conversationController.update.bind(conversationController) as any);
}
