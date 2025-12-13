import { FastifyInstance } from 'fastify';
import { LeadController } from '../controllers/leadController';

const leadController = new LeadController();

export default async function leadRoutes(fastify: FastifyInstance) {
  fastify.post('/', leadController.create);
  fastify.get('/', leadController.getAll);
  fastify.get('/:id', leadController.getById);
  fastify.put('/:id', leadController.update);
  fastify.delete('/:id', leadController.delete);
}
