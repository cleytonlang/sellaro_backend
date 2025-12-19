import { FastifyInstance } from 'fastify';
import { AssistantController } from '../controllers/assistantController';
import { authMiddleware } from '../middlewares/auth';

const assistantController = new AssistantController();

export default async function assistantRoutes(fastify: FastifyInstance) {
  // Todas as rotas de assistant requerem autenticação
  fastify.get('/models', { preHandler: authMiddleware }, assistantController.getModels);
  fastify.post('/', { preHandler: authMiddleware }, assistantController.create);
  fastify.get('/', { preHandler: authMiddleware }, assistantController.getAll);
  fastify.get('/:id', { preHandler: authMiddleware }, assistantController.getById);
  fastify.put('/:id', { preHandler: authMiddleware }, assistantController.update);
  fastify.delete('/:id', { preHandler: authMiddleware }, assistantController.delete);
}
