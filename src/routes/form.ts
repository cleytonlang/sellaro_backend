import { FastifyInstance } from 'fastify';
import { FormController } from '../controllers/formController';
import { authMiddleware } from '../middlewares/auth';

const formController = new FormController();

export default async function formRoutes(fastify: FastifyInstance) {
  // Rota pública (embed não requer autenticação)
  fastify.get('/embed/:embedCode', formController.getByEmbedCode);

  // Rotas protegidas (requerem autenticação)
  fastify.post('/', { preHandler: authMiddleware }, formController.create);
  fastify.get('/', { preHandler: authMiddleware }, formController.getAll);

  // Rotas dinâmicas protegidas
  fastify.get('/:id/kanban-columns', { preHandler: authMiddleware }, formController.getKanbanColumns);
  fastify.get('/:id', { preHandler: authMiddleware }, formController.getById);
  fastify.put('/:id', { preHandler: authMiddleware }, formController.update);
  fastify.delete('/:id', { preHandler: authMiddleware }, formController.delete);
}
