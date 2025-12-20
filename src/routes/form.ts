import { FastifyInstance } from 'fastify';
import { FormController } from '../controllers/formController';
import { authMiddleware } from '../middlewares/auth';

const formController = new FormController();

export default async function formRoutes(fastify: FastifyInstance) {
  // Rota pública (embed não requer autenticação)
  fastify.get('/embed/:embedCode', formController.getByEmbedCode.bind(formController) as any);

  // Rotas protegidas (requerem autenticação)
  fastify.post('/', { preHandler: authMiddleware }, formController.create.bind(formController) as any);
  fastify.get('/', { preHandler: authMiddleware }, formController.getAll.bind(formController) as any);

  // Rotas dinâmicas protegidas
  fastify.get('/:id/kanban-columns', { preHandler: authMiddleware }, formController.getKanbanColumns.bind(formController) as any);
  fastify.get('/:id', { preHandler: authMiddleware }, formController.getById.bind(formController) as any);
  fastify.put('/:id', { preHandler: authMiddleware }, formController.update.bind(formController) as any);
  fastify.delete('/:id', { preHandler: authMiddleware }, formController.delete.bind(formController) as any);
}
