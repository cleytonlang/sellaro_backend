import { FastifyInstance } from 'fastify';
import { AssistantController } from '../controllers/assistantController';
import { authMiddleware } from '../middlewares/auth';

const assistantController = new AssistantController();

export default async function assistantRoutes(fastify: FastifyInstance) {
  // Todas as rotas de assistant requerem autenticação
  fastify.get('/models', { preHandler: authMiddleware }, assistantController.getModels.bind(assistantController) as any);
  fastify.post('/', { preHandler: authMiddleware }, assistantController.create.bind(assistantController) as any);
  fastify.get('/', { preHandler: authMiddleware }, assistantController.getAll.bind(assistantController) as any);
  fastify.get('/:id', { preHandler: authMiddleware }, assistantController.getById.bind(assistantController) as any);
  fastify.put('/:id', { preHandler: authMiddleware }, assistantController.update.bind(assistantController) as any);
  fastify.delete('/:id', { preHandler: authMiddleware }, assistantController.delete.bind(assistantController) as any);
}
