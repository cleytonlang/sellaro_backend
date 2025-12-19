import { FastifyInstance } from 'fastify';
import { LeadController } from '../controllers/leadController';
import { authMiddleware } from '../middlewares/auth';

const leadController = new LeadController();

export default async function leadRoutes(fastify: FastifyInstance) {
  // Todas as rotas de lead requerem autenticação
  fastify.post('/', { preHandler: authMiddleware }, leadController.create);
  fastify.get('/', { preHandler: authMiddleware }, leadController.getAll);
  fastify.get('/:id', { preHandler: authMiddleware }, leadController.getById);
  fastify.put('/:id', { preHandler: authMiddleware }, leadController.update);
  fastify.delete('/:id', { preHandler: authMiddleware }, leadController.delete);
}
