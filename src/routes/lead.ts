import { FastifyInstance } from 'fastify';
import { LeadController } from '../controllers/leadController';
import { authMiddleware } from '../middlewares/auth';

const leadController = new LeadController();

export default async function leadRoutes(fastify: FastifyInstance) {
  // POST não requer autenticação (formulários públicos)
  fastify.post('/', leadController.create.bind(leadController) as any);

  // Demais rotas requerem autenticação
  fastify.get('/', { preHandler: authMiddleware }, leadController.getAll.bind(leadController) as any);
  fastify.get('/:id', { preHandler: authMiddleware }, leadController.getById.bind(leadController) as any);
  fastify.get('/:id/movement-logs', { preHandler: authMiddleware }, leadController.getMovementLogs.bind(leadController) as any);
  fastify.put('/:id', { preHandler: authMiddleware }, leadController.update.bind(leadController) as any);
  fastify.delete('/:id', { preHandler: authMiddleware }, leadController.delete.bind(leadController) as any);
}
