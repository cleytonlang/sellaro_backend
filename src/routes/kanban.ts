import { FastifyInstance } from 'fastify';
import { KanbanController } from '../controllers/kanbanController';
import { authMiddleware } from '../middlewares/auth';

const kanbanController = new KanbanController();

export default async function kanbanRoutes(fastify: FastifyInstance) {
  fastify.post('/', { preHandler: authMiddleware }, kanbanController.create.bind(kanbanController) as any);
  fastify.get('/', { preHandler: authMiddleware }, kanbanController.getAll.bind(kanbanController) as any);
  fastify.get('/:id', { preHandler: authMiddleware }, kanbanController.getById.bind(kanbanController) as any);
  fastify.put('/:id', { preHandler: authMiddleware }, kanbanController.update.bind(kanbanController) as any);
  fastify.delete('/:id', { preHandler: authMiddleware }, kanbanController.delete.bind(kanbanController) as any);
  fastify.post('/reorder', { preHandler: authMiddleware }, kanbanController.reorder.bind(kanbanController) as any);
}
