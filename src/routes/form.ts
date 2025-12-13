import { FastifyInstance } from 'fastify';
import { FormController } from '../controllers/formController';

const formController = new FormController();

export default async function formRoutes(fastify: FastifyInstance) {
  // Specific routes first
  fastify.get('/embed/:embedCode', formController.getByEmbedCode);

  // General routes
  fastify.post('/', formController.create);
  fastify.get('/', formController.getAll);

  // Dynamic routes last
  fastify.get('/:id/kanban-columns', formController.getKanbanColumns);
  fastify.get('/:id', formController.getById);
  fastify.put('/:id', formController.update);
  fastify.delete('/:id', formController.delete);
}
