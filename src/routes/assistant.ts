import { FastifyInstance } from 'fastify';
import { AssistantController } from '../controllers/assistantController';

const assistantController = new AssistantController();

export default async function assistantRoutes(fastify: FastifyInstance) {
  fastify.get('/models', assistantController.getModels);
  fastify.post('/', assistantController.create);
  fastify.get('/', assistantController.getAll);
  fastify.get('/:id', assistantController.getById);
  fastify.put('/:id', assistantController.update);
  fastify.delete('/:id', assistantController.delete);
}
