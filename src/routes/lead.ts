import { FastifyInstance } from 'fastify';
import { LeadController } from '../controllers/leadController';
import { authMiddleware } from '../middlewares/auth';

const leadController = new LeadController();

export default async function leadRoutes(fastify: FastifyInstance) {
  // Todas as rotas de lead requerem autenticação
  fastify.post('/', { preHandler: authMiddleware }, leadController.create.bind(leadController) as any);
  fastify.get('/', { preHandler: authMiddleware }, leadController.getAll.bind(leadController) as any);
  fastify.get('/:id', { preHandler: authMiddleware }, leadController.getById.bind(leadController) as any);
  fastify.put('/:id', { preHandler: authMiddleware }, leadController.update.bind(leadController) as any);
  fastify.delete('/:id', { preHandler: authMiddleware }, leadController.delete.bind(leadController) as any);
}
