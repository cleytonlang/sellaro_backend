import { FastifyInstance } from 'fastify';
import { KanbanController } from '../controllers/kanbanController';

const kanbanController = new KanbanController();

export default async function kanbanRoutes(fastify: FastifyInstance) {
  fastify.post('/', kanbanController.create);
  fastify.get('/', kanbanController.getAll);
  fastify.get('/:id', kanbanController.getById);
  fastify.put('/:id', kanbanController.update);
  fastify.delete('/:id', kanbanController.delete);
  fastify.post('/reorder', kanbanController.reorder);
}
